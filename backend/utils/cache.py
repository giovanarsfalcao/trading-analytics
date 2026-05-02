"""
Persistent SQLite cache for OHLCV bars and fundamentals.

Design:
- One file at $CACHE_DB_PATH (default ./cache.db, /app/data/cache.db on fly.io).
- WAL mode → concurrent reads + serial writes → both Uvicorn workers can share it.
- Connection per call — cheap with WAL, no pool needed at this scale.
"""

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Optional

import pandas as pd


DEFAULT_DB_PATH = os.environ.get("CACHE_DB_PATH", "./cache.db")


@contextmanager
def _connect(db_path: str):
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def ensure_schema(db_path: str = DEFAULT_DB_PATH) -> None:
    """Create tables if they don't exist. Safe to call repeatedly."""
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)

    with _connect(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS ohlcv (
                ticker   TEXT NOT NULL,
                interval TEXT NOT NULL,
                date     TEXT NOT NULL,
                open     REAL,
                high     REAL,
                low      REAL,
                close    REAL,
                volume   REAL,
                PRIMARY KEY (ticker, interval, date)
            );

            CREATE TABLE IF NOT EXISTS ohlcv_meta (
                ticker     TEXT NOT NULL,
                interval   TEXT NOT NULL,
                fetched_at INTEGER NOT NULL,
                PRIMARY KEY (ticker, interval)
            );

            CREATE TABLE IF NOT EXISTS fundamentals (
                ticker     TEXT PRIMARY KEY,
                fetched_at INTEGER NOT NULL,
                data       TEXT NOT NULL
            );
        """)


# ============================================================
# OHLCV
# ============================================================


def get_ohlcv_range(
    ticker: str,
    interval: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db_path: str = DEFAULT_DB_PATH,
) -> pd.DataFrame:
    """
    Return cached bars in [start_date, end_date]. Empty DataFrame if nothing matches.
    Returns columns: Open, High, Low, Close, Volume with a DatetimeIndex (matches yfinance shape).
    """
    query = """
        SELECT date, open, high, low, close, volume
        FROM ohlcv
        WHERE ticker = ? AND interval = ?
    """
    params: list = [ticker.upper(), interval]
    if start_date is not None:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date is not None:
        query += " AND date <= ?"
        params.append(end_date)
    query += " ORDER BY date"

    with _connect(db_path) as conn:
        df = pd.read_sql_query(query, conn, params=params)

    if df.empty:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df.index.name = None
    df = df.rename(columns={
        "open": "Open", "high": "High", "low": "Low",
        "close": "Close", "volume": "Volume",
    })
    return df


def get_last_cached_date(
    ticker: str,
    interval: str,
    db_path: str = DEFAULT_DB_PATH,
) -> Optional[pd.Timestamp]:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT MAX(date) FROM ohlcv WHERE ticker = ? AND interval = ?",
            (ticker.upper(), interval),
        ).fetchone()
    if row is None or row[0] is None:
        return None
    return pd.to_datetime(row[0])


def get_first_cached_date(
    ticker: str,
    interval: str,
    db_path: str = DEFAULT_DB_PATH,
) -> Optional[pd.Timestamp]:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT MIN(date) FROM ohlcv WHERE ticker = ? AND interval = ?",
            (ticker.upper(), interval),
        ).fetchone()
    if row is None or row[0] is None:
        return None
    return pd.to_datetime(row[0])


def get_last_fetched_at(
    ticker: str,
    interval: str,
    db_path: str = DEFAULT_DB_PATH,
) -> Optional[int]:
    """Unix timestamp of the last yfinance call for this (ticker, interval), or None."""
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT fetched_at FROM ohlcv_meta WHERE ticker = ? AND interval = ?",
            (ticker.upper(), interval),
        ).fetchone()
    return row[0] if row else None


def upsert_ohlcv(
    df: pd.DataFrame,
    ticker: str,
    interval: str,
    db_path: str = DEFAULT_DB_PATH,
) -> int:
    """
    Insert bars from df into the cache. Existing bars (same ticker+interval+date) are replaced.
    df is expected to have a DatetimeIndex and columns Open, High, Low, Close, Volume.
    Returns the number of rows written.
    """
    if df.empty:
        return 0

    rows = [
        (
            ticker.upper(),
            interval,
            idx.strftime("%Y-%m-%dT%H:%M:%S"),
            float(row["Open"]) if pd.notna(row["Open"]) else None,
            float(row["High"]) if pd.notna(row["High"]) else None,
            float(row["Low"]) if pd.notna(row["Low"]) else None,
            float(row["Close"]) if pd.notna(row["Close"]) else None,
            float(row["Volume"]) if pd.notna(row["Volume"]) else None,
        )
        for idx, row in df.iterrows()
    ]

    with _connect(db_path) as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO ohlcv
                (ticker, interval, date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
    return len(rows)


def update_fetched_at(
    ticker: str,
    interval: str,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """Mark this (ticker, interval) as just fetched from yfinance."""
    now = int(time.time())
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO ohlcv_meta (ticker, interval, fetched_at)
            VALUES (?, ?, ?)
            ON CONFLICT(ticker, interval) DO UPDATE SET fetched_at = excluded.fetched_at
            """,
            (ticker.upper(), interval, now),
        )


# ============================================================
# Fundamentals
# ============================================================


def get_fundamentals(
    ticker: str,
    ttl_seconds: int,
    db_path: str = DEFAULT_DB_PATH,
) -> Optional[dict]:
    """Return cached fundamentals dict if fresh, else None."""
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT fetched_at, data FROM fundamentals WHERE ticker = ?",
            (ticker.upper(),),
        ).fetchone()
    if row is None:
        return None
    fetched_at, data_json = row
    if int(time.time()) - fetched_at >= ttl_seconds:
        return None
    return json.loads(data_json)


def set_fundamentals(
    ticker: str,
    data: dict,
    db_path: str = DEFAULT_DB_PATH,
) -> None:
    """Store fundamentals dict. Drops 'raw_info' key to keep storage lean."""
    payload = {k: v for k, v in data.items() if k != "raw_info"}
    now = int(time.time())
    with _connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO fundamentals (ticker, fetched_at, data)
            VALUES (?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
                fetched_at = excluded.fetched_at,
                data       = excluded.data
            """,
            (ticker.upper(), now, json.dumps(payload)),
        )
