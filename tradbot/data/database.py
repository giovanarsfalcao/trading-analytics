"""
TradBot Database Module

SQLAlchemy ORM models für Trading Data Persistence.
Nutzt SQLite (kein Server nötig, file-based).

Verwendung:
    from tradbot.data import create_tables
    create_tables()  # Erstellt alle Tabellen
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

# =============================================================================
# DATABASE CONNECTION
# =============================================================================

# SQLite Datei im Project Root
DATABASE_URL = "sqlite:///tradbot.db"

# Engine: Verbindung zur Datenbank
engine = create_engine(DATABASE_URL, echo=False)

# Session: Interaktion mit der Datenbank
Session = sessionmaker(bind=engine)

# Base: Alle Models erben hiervon
Base = declarative_base()


# =============================================================================
# MODELS (Tabellen)
# =============================================================================

class MarketData(Base):
    """
    OHLCV Preisdaten von Yahoo Finance.

    Speichert tägliche/stündliche Preisdaten pro Ticker.
    """
    __tablename__ = "market_data"

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    interval = Column(String(5), default="1d")  # 1d, 1h, 15m, 5m

    # OHLCV
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)

    def __repr__(self):
        return f"<MarketData {self.ticker} {self.date}>"


class PortfolioSnapshot(Base):
    """
    Portfolio State zu einem Zeitpunkt.

    Speichert Gewichte und Gesamtwert für Performance Tracking.
    """
    __tablename__ = "portfolio_snapshots"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Portfolio Zusammensetzung (String Format)
    # Beispiel: "AAPL:0.4,MSFT:0.6"
    weights = Column(String(500), nullable=False)

    # Portfolio Metriken
    total_value = Column(Float)
    cash = Column(Float)

    # Optimierungs-Methode
    strategy = Column(String(50))  # 'max_sharpe', 'min_volatility'

    def __repr__(self):
        return f"<PortfolioSnapshot {self.timestamp} ${self.total_value}>"


class PerformanceMetric(Base):
    """
    Risk Metrics zu einem Zeitpunkt.

    Speichert Sharpe, VaR, MaxDrawdown für Tracking.
    """
    __tablename__ = "performance_metrics"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    ticker = Column(String(10), nullable=True)  # NULL = Portfolio-Level

    # Core Metrics (aus tradbot.risk)
    sharpe_ratio = Column(Float)
    max_drawdown = Column(Float)
    var_95 = Column(Float)
    var_99 = Column(Float)

    # Zusätzliche Metriken
    annualized_return = Column(Float)
    annualized_volatility = Column(Float)

    def __repr__(self):
        return f"<PerformanceMetric {self.ticker or 'Portfolio'} Sharpe={self.sharpe_ratio:.2f}>"


# =============================================================================
# UTILITY FUNCTION
# =============================================================================

def create_tables():
    """Erstellt alle Tabellen in der Datenbank."""
    Base.metadata.create_all(engine)
    print("[Database] Tabellen erstellt")
