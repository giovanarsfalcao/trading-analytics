# Krypto-Arbitrage Bot — Implementierungsplan

## Context

Die Trading Analytics Plattform hat einen vollständigen Analyse-Stack (Indikatoren, Strategien, Backtester, Risk-Analyse). Jetzt soll ein Krypto-Arbitrage Bot gebaut werden, der Preisunterschiede zwischen Krypto-Exchanges ausnutzt. Die bestehenden `utils/` Module (indicators, risk_analysis) werden für Analyse und Monitoring wiederverwendet. Die Arbitrage-Logik selbst ist komplett neu.

**Warum Krypto-Arbitrage (und nicht NYSE):**
- Krypto-Märkte sind fragmentiert (100+ Exchanges) → mehr Ineffizienzen
- Keine Co-Location nötig (kein NY4 Data Center für $20k/Monat)
- 24/7 Markt → Bot läuft rund um die Uhr
- Niedrige Einstiegshürde (kein Pattern Day Trader Minimum von $25k)

**Datenquellen:**
- **NICHT Databento** — Databento liefert nur traditionelle Börsen (NYSE, NASDAQ, CME)
- **CCXT** — Unified API für 100+ Krypto-Exchanges (kostenlos, Open Source)
- **Exchange WebSockets** — Echtzeit Order Book und Trades direkt von Binance, Kraken, Coinbase etc.

---

## Technologien die du kennen musst

### Must-Have (vor dem Start)

| Technologie | Warum | Wie lernen |
|---|---|---|
| **Python asyncio** | WebSockets und parallele Exchange-Anfragen brauchen async/await | `asyncio` Docs + eigene kleine Projekte |
| **WebSockets** | Echtzeit-Preisdaten von Exchanges empfangen | `websockets` oder `ccxt.pro` Library |
| **CCXT Library** | Unified API für alle Krypto-Exchanges (Orders, Balances, Order Books) | ccxt Docs + GitHub Examples |
| **Order Book Mechanik** | Bid/Ask, Spread, Depth, Slippage verstehen | Investopedia + Binance Order Book live anschauen |
| **Exchange APIs** | REST + WebSocket APIs von Binance/Kraken verstehen | Exchange API Docs |

### Gut zu wissen (während der Entwicklung)

| Technologie | Warum |
|---|---|
| **Docker** | Bot auf Cloud-Server deployen |
| **SQLite/PostgreSQL** | Trade-Logging und Performance-Tracking |
| **Linux Basics** | Server-Administration (VPS Setup, systemd Services) |
| **Netzwerk-Latenz** | Traceroute, Ping zu Exchange-Servern verstehen |

---

## 3 Arten von Krypto-Arbitrage (von einfach → komplex)

### Typ 1: Cross-Exchange Arbitrage (Empfohlen zum Start)
BTC kostet $67,100 auf Binance und $67,250 auf Kraken → Kaufe auf Binance, verkaufe auf Kraken = $150 Profit (minus Fees).

**Voraussetzung:** Kapital auf BEIDEN Exchanges vorhalten (kein Transfer nötig pro Trade).

### Typ 2: Triangular Arbitrage (Mittlere Komplexität)
Auf EINER Exchange: BTC/USDT → ETH/BTC → ETH/USDT. Wenn die drei Preise inkonsistent sind, ergibt der Kreislauf Profit.

**Vorteil:** Kein Kapital auf mehreren Exchanges nötig.

### Typ 3: Funding Rate Arbitrage (Fortgeschritten)
Long Spot + Short Perpetual Future auf gleichen Asset. Funding Rate zahlt dir alle 8h eine Prämie.

**Vorteil:** Marktneutrales Income (egal ob Preis steigt oder fällt).

---

## Architektur

```
bot/
├── config.py                   # API Keys, Exchange-Config, Limits (.env)
├── clients/
│   ├── exchange_manager.py     # CCXT Multi-Exchange Manager (Binance, Kraken, Coinbase)
│   └── websocket_feed.py      # Echtzeit Order Book Streams (asyncio + ccxt.pro)
├── arbitrage/
│   ├── cross_exchange.py       # Cross-Exchange Spread Detection + Execution
│   ├── triangular.py           # Triangular Arb innerhalb einer Exchange
│   └── funding_rate.py         # Funding Rate Arb (Spot + Perp) — Phase 3
├── executor.py                 # Order-Ausführung (gleichzeitig auf 2 Exchanges)
├── risk_guard.py               # Position Limits, Max Loss, Kill Switch
├── logger.py                   # Trade-Log in SQLite
├── monitor.py                  # Live Dashboard: Spreads, PnL, Latenz
└── run.py                      # Entry Point (asyncio Event Loop)
```

**Wiederverwendete Module aus der Plattform:**
- `utils/indicators.py` → Volatility-Analyse (ATR, Bollinger) für dynamische Thresholds
- `utils/risk_analysis.py` → Sharpe, VaR, Max Drawdown für Performance-Monitoring

---

## Implementierung — Schritt für Schritt

### Phase 1: Cross-Exchange Arbitrage (Paper Mode) — ~2 Wochen

#### Schritt 1: `bot/config.py`
```python
# .env Datei
BINANCE_API_KEY=...
BINANCE_SECRET=...
KRAKEN_API_KEY=...
KRAKEN_SECRET=...

# Config
EXCHANGES = ["binance", "kraken"]          # Welche Exchanges
PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]  # Welche Paare
MIN_SPREAD_PCT = 0.15                      # Minimum Spread um Fees zu decken (0.15%)
MAX_POSITION_USDT = 1000                   # Max pro Trade in USDT
PAPER_MODE = True                          # Keine echten Orders
KILL_SWITCH = False
```

#### Schritt 2: `bot/clients/exchange_manager.py`
- CCXT verwenden um mehrere Exchanges gleichzeitig zu managen
- Funktionen:
  - `get_ticker(exchange, pair)` → Aktueller Bid/Ask Preis
  - `get_order_book(exchange, pair, depth=10)` → Top 10 Bids und Asks
  - `get_balance(exchange)` → Verfügbares Kapital pro Exchange
  - `get_fees(exchange, pair)` → Maker/Taker Fees
- Alle Exchanges in einem Dict: `{"binance": ccxt.binance({...}), "kraken": ccxt.kraken({...})}`

#### Schritt 3: `bot/clients/websocket_feed.py`
- `ccxt.pro` (die async Version von ccxt) für WebSocket Streams
- `watch_order_book(exchange, pair)` → Echtzeit Order Book Updates
- `watch_ticker(exchange, pair)` → Echtzeit Bid/Ask
- Asyncio Event Loop: alle Exchanges parallel subscriben
- Callbacks wenn neuer Preis reinkommt → Spread neu berechnen

#### Schritt 4: `bot/arbitrage/cross_exchange.py` (Kernlogik)
```
Ablauf (alle paar Sekunden):
1. Für jedes Paar (z.B. BTC/USDT):
   a. Hole Bid/Ask von allen Exchanges
   b. Finde: Niedrigstes Ask (= wo am günstigsten kaufen)
   c. Finde: Höchstes Bid (= wo am teuersten verkaufen)
   d. Berechne Spread: (highest_bid - lowest_ask) / lowest_ask * 100
   e. Abzüge: Taker Fee Exchange A + Taker Fee Exchange B
   f. Netto-Spread = Brutto-Spread - Total Fees
   g. Wenn Netto-Spread > MIN_SPREAD_PCT → TRADE SIGNAL

2. Spread-Berechnung Beispiel:
   Binance Ask: $67,100 (kaufen hier)
   Kraken Bid:  $67,250 (verkaufen hier)
   Brutto-Spread: ($67,250 - $67,100) / $67,100 = 0.223%
   Binance Taker Fee: 0.075%
   Kraken Taker Fee:  0.060%
   Netto-Spread: 0.223% - 0.075% - 0.060% = 0.088%
   → Bei $1,000 Trade = $0.88 Profit
   → Bei $10,000 Trade = $8.80 Profit
```

#### Schritt 5: `bot/executor.py`
- **Gleichzeitige Ausführung** (kritisch!): Buy auf Exchange A und Sell auf Exchange B MÜSSEN parallel passieren
- `asyncio.gather(buy_order, sell_order)` — beide Orders gleichzeitig absenden
- Paper Mode: Orders nur loggen, nicht ausführen
- Live Mode: `exchange.create_market_order(pair, side, amount)`
- Fehlerbehandlung: Was wenn eine Seite filled und die andere nicht? → Sofort die offene Position schließen

#### Schritt 6: `bot/risk_guard.py`
- `check_balance_sufficient(exchange, amount)` → Genug Kapital auf der Exchange?
- `check_daily_loss(max_loss_pct=3.0)` → Stop wenn 3% Tagesverlust
- `check_spread_realistic(spread, avg_spread)` → Extrem hoher Spread = evtl. Datenfehler
- `check_order_book_depth(order_book, trade_size)` → Genug Liquidität?
- `kill_switch_active()` → Sofort alles stoppen

#### Schritt 7: `bot/logger.py`
- SQLite: `bot/data/arb_trades.db`
- Tabelle `arb_trades`: timestamp, pair, buy_exchange, sell_exchange, buy_price, sell_price, spread_pct, net_profit, fees, amount, status
- Tabelle `spreads`: timestamp, pair, exchange_a, exchange_b, bid_a, ask_a, bid_b, ask_b, spread_pct (für Analyse)
- Tabelle `balances`: timestamp, exchange, asset, free, used, total

#### Schritt 8: `bot/run.py`
```
async def main():
    1. Exchanges initialisieren (CCXT)
    2. WebSocket Feeds starten (alle Exchanges, alle Paare)
    3. Event Loop:
       - Bei jedem Preis-Update → Spread berechnen
       - Wenn Spread > Threshold → Risk Check → Execute → Log
    4. Parallel: Balance-Check alle 60 Sekunden
    5. Parallel: Performance-Report alle Stunde loggen
```
- CLI: `python -m bot.run` (startet asyncio Loop)
- Graceful Shutdown: Ctrl+C → alle offenen Orders canceln, Positionen loggen

**Neue Dependencies:** `ccxt` (oder `ccxt.pro` für WebSockets), `aiosqlite`, `python-dotenv`

---

### Phase 2: Triangular Arbitrage — ~1 Woche (nach Phase 1)

#### Schritt 9: `bot/arbitrage/triangular.py`
```
Beispiel auf Binance:
1. Start: 1000 USDT
2. Kaufe BTC mit USDT: 1000 / 67,100 = 0.01490 BTC
3. Kaufe ETH mit BTC: 0.01490 / 0.0520 = 0.2865 ETH
4. Verkaufe ETH für USDT: 0.2865 * 3,510 = 1005.6 USDT
5. Profit: $5.60 (0.56%) — minus 3x Taker Fee (3 * 0.075% = 0.225%)
6. Netto: ~0.34% = $3.35

Ablauf:
- Alle möglichen Dreiecke berechnen (BTC/USDT → ETH/BTC → ETH/USDT, etc.)
- Für jedes Dreieck: theoretischer Return berechnen
- Wenn Return > 3x Fees → Execute alle 3 Legs sequentiell
```
- Funktioniert auf EINER Exchange → kein Kapital-Splitting nötig
- Höhere Frequenz möglich (kein Cross-Exchange Latenz-Problem)

---

### Phase 3: Cloud Deployment — ~3-5 Tage

#### Server-Setup für niedrige Latenz

**Wo den Server platzieren:**
- **Binance:** Server in Tokyo (AWS `ap-northeast-1`) oder Singapur (`ap-southeast-1`)
- **Kraken:** Server in London oder Frankfurt (AWS `eu-west-2` oder `eu-central-1`)
- **Kompromiss:** Frankfurt (AWS `eu-central-1`) — gute Latenz zu beiden
- **Alternativen zu AWS:** Hetzner (€4/Monat für VPS in Frankfurt), DigitalOcean, Vultr

#### Deployment
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY bot/ bot/
COPY utils/ utils/
COPY .env .
CMD ["python", "-m", "bot.run"]
```
- `systemd` Service oder Docker Compose auf dem VPS
- Auto-Restart bei Crash
- Log-Rotation (Logs werden groß bei 24/7 Betrieb)
- Monitoring: Healthcheck-Endpoint oder Telegram-Alert bei Fehler

---

### Phase 4: Live Trading — nach 2-4 Wochen Paper Trading

**Go-Live Kriterien:**
- Paper Trading zeigt konsistente Spreads > MIN_SPREAD_PCT
- Keine technischen Ausfälle über 2+ Wochen
- Risk Guard hat keine False Positives/Negatives
- Verständnis der Exchange Fee-Strukturen (Maker vs Taker, VIP Tiers)

**Kapital-Strategie:**
- Kapital auf 2-3 Exchanges aufteilen (z.B. 40% Binance, 30% Kraken, 30% Coinbase)
- Start mit $2,000-3,000 total
- **Rebalancing:** Wenn eine Exchange mehr Kapital akkumuliert → manuell transferieren
  (oder automatisch via CCXT `withdraw()` — aber Vorsicht, Withdrawals sind irreversibel)

**Realistische Erwartungen:**
- Cross-Exchange Spreads: 0.05%-0.30% (vor Fees)
- Netto pro Trade: 0.01%-0.10%
- 10-50 Trades/Tag realistisch
- Bei $5,000 Kapital und 0.05% Netto pro Trade und 20 Trades/Tag:
  $5,000 * 0.0005 * 20 = **$50/Tag = ~$1,500/Monat**
- Das ist der OPTIMISTISCHE Fall. Realistischer: $10-30/Tag am Anfang

---

## Kritische Dateien

| Neue Datei | Rolle | Priorität |
|---|---|---|
| `bot/arbitrage/cross_exchange.py` | Spread Detection + Trade Logic | **HÖCHSTE** |
| `bot/executor.py` | Gleichzeitige Order-Ausführung | **HÖCHSTE** |
| `bot/risk_guard.py` | Schutz vor Verlusten + Kill Switch | **HÖCHSTE** |
| `bot/clients/exchange_manager.py` | Multi-Exchange CCXT Wrapper | Hoch |
| `bot/clients/websocket_feed.py` | Echtzeit-Daten | Hoch |
| `bot/arbitrage/triangular.py` | Triangular Arb | Mittel (Phase 2) |
| `bot/logger.py` | Trade-Logging | Mittel |
| `bot/monitor.py` | Live Performance Dashboard | Niedrig |

| Bestehende Datei | Rolle |
|---|---|
| `utils/indicators.py` | ATR/Bollinger für dynamische Spread-Thresholds |
| `utils/risk_analysis.py` | Sharpe, VaR, Drawdown für Performance-Reports |
| `utils/yfinance_fix.py` | NICHT anfassen — nicht relevant für Arb Bot |

---

## Verification

1. **Paper Mode testen:** Bot 2-4 Wochen im Paper Mode laufen lassen, alle Trades loggen
2. **Spread-Analyse:** Historische Spreads zwischen Exchanges visualisieren — gibt es überhaupt genug Opportunities?
3. **Latenz messen:** Ping zu Exchange APIs messen, Order Execution Time tracken
4. **Fee-Kalkulation prüfen:** Manuell nachrechnen ob Netto-Profit nach allen Fees positiv
5. **Stress-Tests:** Was passiert bei hoher Volatilität? Flash Crash? Exchange Downtime?
6. **Risk Guard testen:** Kill Switch manuell triggern, Daily Loss Limit testen

## Wichtige Hinweise

- **Kapital-Risiko:** Arbitrage gilt als "low risk" aber ist NICHT risikofrei (Execution Risk, Exchange Risk, Liquiditätsrisiko)
- **Exchange-Risiko:** Dein Geld liegt auf zentralisierten Exchanges → Insolvenz-Risiko (siehe FTX)
- **Withdrawal-Limits:** Exchanges haben tägliche Auszahlungslimits und KYC-Anforderungen
- **Fee-Tiers:** Binance/Kraken haben VIP-Tiers → je mehr Volumen, desto niedrigere Fees → Profitabilität steigt mit der Zeit
- **Rebalancing-Problem:** Kapital konzentriert sich auf einer Seite → muss regelmäßig umverteilt werden (Transfer-Kosten + Zeit)
- Kill Switch IMMER eingebaut und getestet
- **NIEMALS** Geld investieren, das man nicht verlieren kann
