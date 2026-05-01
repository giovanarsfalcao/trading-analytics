# Plan: Algo Trading Bot + LangGraph AI Agent

## Context

Erweiterung des bestehenden Trading-Analytics-Projekts (Next.js 16 + FastAPI + Python Utils) um **Market-Making** (Avellaneda-Stoikov), **LightGBM + Purged CV**, **Monitoring-Infrastruktur** und einen **LangGraph-basierten AI Agent** mit Tool Use, Multi-Step Reasoning und RAG.

**Was bereits existiert:** OHLCV-Daten, Bollinger-Bands, Walk-Forward, Risk-Metriken, ML (RF/GB/LR), Docker/Fly.io.
**Was fehlt:** Avellaneda-Stoikov, LightGBM, OFI, Purged K-Fold, InfluxDB/Grafana, AI Agent/RAG.

**Architektur-Entscheidungen:**
- Kein vectorbt (Custom Backtester bleibt, Notebook zeigt Vergleich)
- AI Agent eingebettet als rechte Sidebar (kein Streamlit, kein separates Verzeichnis)
- Agent nutzt LangGraph für Multi-Step Reasoning + LangChain für RAG
- Agent hat Tools: kann eigenständig Backtests starten, Risk berechnen, Strategien vergleichen, Daten fetchen
- Agent-Kontext aus Zustand Store + optional RAG (10-K Reports)
- InfluxDB/Grafana nur lokal + AWS (Fly.io zu klein)

**Job-Anforderungen Coverage — AI/ML Rolle:**
| Anforderung | Schritt |
|---|---|
| ML/LLMOps + AI Agent Infra (AWS) | 1.13–1.18, 2.13 |
| LLM Frameworks + AI Agent Architectures | 2.1–2.3 (LangGraph Agent) |
| AI Agent Evaluation (reasoning quality) | 2.11 (Agent Eval Framework) |
| RAG Pipelines + OpenSearch | 2.8–2.10, 2.12 |
| LangChain / LangGraph | 2.1 (LangGraph), 2.8 (LangChain RAG) |
| AI Agents + Tool Use + Multi-Step Reasoning | 2.2 (Agent Tools), 2.3 (Multi-Step) |
| ML Packages (pandas, sklearn) | Phase 1 komplett |
| AWS Cloud Infrastructure | 1.14, 1.18, 2.13 |
| LLM-powered Apps (Chatbots, Info Retrieval) | Phase 2 komplett |
| Document Summarization | 2.9 (Summarization Tool) |

**Job-Anforderungen Coverage — Quant Trader Rolle:**
| Anforderung | Schritt |
|---|---|
| Market Making (Equities, ETFs) | 1.5–1.8 (Avellaneda-Stoikov) |
| Design, backtest, implement trading algorithms | Phase 1 komplett |
| Market microstructure, limit order books | 1.1–1.3 (Order Book, Spread, Impact) |
| Time-series databases (InfluxDB) | 1.13–1.14 |
| Streaming technologies (Kafka) | 1.16 (Kafka + WebSocket Live-Feed) |
| Real-time data streams | 1.16 (Live-Preis-Stream) |
| SQL | 1.15 (Trade-Logging, SQLAlchemy, Raw SQL Queries) |
| Risk management | Existiert + 1.5–1.8 (Inventory Risk) |
| Automated testing, code quality | 1.17 (pytest Suite + CI/CD Integration) |
| Git, CI/CD, Docker | Existiert + 1.17 (pytest in GitHub Actions) |
| Data visualization | Existiert + 1.16 (Live-Chart) |
| Python, pandas, sklearn | Phase 1 komplett |
| AWS Cloud Infrastructure | 1.18 (EC2 Deployment) |

---

## Phase 1: Algo Trading Bot

### Schritt 1.1 — Market Structure Backend
> `utils/market_structure.py` erstellen

- `simulate_order_book(price, volume, atr, levels=5)` — Synthetisches L2 Order Book aus OHLCV
- `estimate_market_impact(order_size, avg_volume, atr)` — Almgren-Chriss Market Impact
- `calculate_effective_spread(high, low, close)` — Roll's Effective Spread Estimator
- **Test:** Funktion mit AAPL-Daten aufrufen, Output validieren

### Schritt 1.2 — Market Structure API
> `backend/main.py` ändern

- `MarketStructureRequest` Pydantic Model hinzufügen
- `POST /api/market-structure` Endpoint: Daten fetchen → market_structure Funktionen aufrufen → JSON Response
- **Test:** `curl -X POST localhost:8000/api/market-structure -d '{"ticker":"AAPL","period":"1y"}'`

### Schritt 1.3 — Market Structure Frontend
> Neue + geänderte Dateien im Frontend

- `frontend/src/components/explore/OrderBookViz.tsx` erstellen — Recharts BarChart (Bid/Ask Levels)
- `frontend/src/app/page.tsx` ändern — "Market Structure" Tab im Explore-Stage
- **Test:** UI öffnen → Explore → Market Structure Tab → Order Book wird angezeigt

---

### Schritt 1.4 — Notebooks (Dokumentation)
> Neue Notebooks

- `notebooks/vectorbt_comparison.ipynb` — Vergleich Custom Backtester vs. vectorbt auf gleicher Strategie
- `notebooks/walk_forward_analysis.ipynb` — Fold-Visualisierung, OOS-Performance
- **Test:** Notebooks lokal ausführen, Outputs verifizieren

---

### Schritt 1.5 — Avellaneda-Stoikov: Kernmodul
> `utils/market_making.py` erstellen

- `reservation_price(mid, inventory, gamma, sigma, T)` → r = s - q·γ·σ²·(T-t)
- `optimal_spread(gamma, sigma, T, kappa)` → δ = γ·σ²·(T-t) + (2/γ)·ln(1 + γ/κ)
- `optimal_quotes(mid, inventory, gamma, sigma, T, kappa)` → (bid_price, ask_price)
- `run_market_making_simulation(price_data, gamma, kappa, sigma, max_inventory, session_bars)` → dict mit PnL, Inventory-Series, Quote-History, Trades
- **Test:** Simulation auf AAPL 1-Minute-Daten → PnL-Kurve plotten im Notebook

### Schritt 1.6 — Avellaneda-Stoikov: API
> `backend/main.py` ändern

- `MarketMakingRequest` Pydantic Model (ticker, period, interval, gamma, kappa, max_inventory, session_bars)
- `POST /api/market-making` Endpoint
- **Test:** `curl` Request → PnL, Inventory, Quotes als JSON zurück

### Schritt 1.7 — Avellaneda-Stoikov: Types + Store
> Frontend-Grundlagen

- `frontend/src/types/index.ts` ändern — `MarketMakingResult`, `QuotePoint`, `InventoryPoint` Interfaces
- `frontend/src/stores/store.ts` ändern — `marketMakingResult` State, `setMarketMakingData()` Action
- **Test:** TypeScript kompiliert fehlerfrei

### Schritt 1.8 — Avellaneda-Stoikov: Frontend-Komponenten
> Neue Komponenten

- `frontend/src/components/strategy/MarketMakingForm.tsx` — Slider-Controls für gamma, kappa, max_inventory
- `frontend/src/components/strategy/MarketMakingChart.tsx` — 3-Panel: Price+Quotes oben, Inventory Mitte, PnL unten
- `frontend/src/components/strategy/SpreadDynamicsChart.tsx` — Spread vs. Inventory/Volatility
- `frontend/src/app/page.tsx` ändern — Conditional Rendering: wenn "Avellaneda-Stoikov" gewählt → MM-Komponenten statt normaler Signal-Flow
- **Test:** UI → Strategy → Avellaneda-Stoikov wählen → Parameter einstellen → Simulation starten → 3 Charts werden angezeigt

---

### Schritt 1.9 — Order Flow Imbalance
> `utils/order_flow.py` erstellen + `utils/indicators.py` ändern

- `order_flow_imbalance(df, window=20)` — OFI aus OHLCV: buy_vol = V·(C-L)/(H-L), sell_vol = V·(H-C)/(H-L)
- `volume_imbalance_ratio(df, window=20)` — VIR = buy_vol / (buy_vol + sell_vol)
- `trade_flow_toxicity(df, window=20)` — VPIN-inspiriert
- `utils/indicators.py` ändern — OFI-Features in `calculate_all_indicators()` integrieren
- **Test:** `calculate_all_indicators(aapl_df)` enthält Spalten `OFI`, `VIR`, `VPIN`

### Schritt 1.10 — Purged K-Fold Cross-Validation
> `utils/purged_cv.py` erstellen

- `PurgedKFoldCV(n_splits=5, embargo_pct=0.01)` Klasse
- `split(X, y, dates)` → yields (train_idx, test_idx) mit Purge-Zone + Embargo
- Implementiert López de Prado's Methode: keine überlappenden Labels zwischen Train/Test
- **Test:** Split auf 2 Jahre AAPL daily → Fold-Grenzen + Purge-Zonen visualisieren

### Schritt 1.11 — LightGBM Integration
> `utils/strategies.py` ändern + `backend/requirements.txt` ändern

- `backend/requirements.txt` — `lightgbm>=4.0.0` hinzufügen
- `utils/strategies.py` — LightGBM in `MODEL_REGISTRY`, `purged_kfold_ml_strategy()` Funktion, `cv_method` Parameter
- `backend/main.py` — Strategy/Walk-Forward Endpoints um `cv_method` erweitern
- **Test:** `POST /api/strategy` mit model="LightGBM", cv_method="purged_kfold" → Accuracy, F1, Fold-Results

### Schritt 1.12 — LightGBM + Purged CV Frontend
> Frontend-Änderungen

- `frontend/src/components/strategy/StrategyForm.tsx` ändern — LightGBM im ML-Dropdown, OFI-Feature Checkboxen, CV-Methode Selector
- `frontend/src/components/strategy/PurgedCVTimeline.tsx` erstellen — Fold-Visualisierung mit Purge/Embargo-Zonen
- **Test:** UI → Strategy → ML: LightGBM → Purged K-Fold → Features mit OFI → Run → Timeline + Metriken

---

### Schritt 1.13 — InfluxDB Writer
> `utils/influxdb_writer.py` erstellen

- `InfluxDBWriter(url, token, org, bucket)` Klasse
- `write_backtest_results(ticker, strategy, results)` — Backtest-Metriken schreiben
- `write_risk_metrics(ticker, metrics)` — Risk-Daten schreiben
- `query_performance_history(ticker, time_range)` — Historische Runs abfragen
- Gated hinter `INFLUXDB_URL` Env-Var (No-Op wenn nicht gesetzt)
- `backend/main.py` ändern — nach Backtest/Risk optional InfluxDB-Write
- `backend/requirements.txt` — `influxdb-client>=1.36.0`
- **Test:** Lokaler InfluxDB-Container → Backtest → Daten in InfluxDB verifizieren

### Schritt 1.14 — Docker-Compose + Grafana
> Infrastruktur-Dateien

- `infra/docker-compose.yml` — App + InfluxDB 2.7 + Grafana 10.0
- `infra/grafana/datasources/influxdb.yml` — Auto-Provisioning der InfluxDB Datasource
- `infra/grafana/dashboards/trading-analytics.json` — Dashboard: Equity Curve, Drawdown, Risk-Gauges, MM Inventory
- **Test:** `docker-compose up` → Backtest laufen → Grafana Dashboard zeigt Daten

### Schritt 1.15 — SQL Trade-Logging (PostgreSQL/SQLite)
> `utils/trade_db.py` erstellen + `backend/main.py` ändern

- `utils/trade_db.py` — `TradeDatabase` Klasse:
  - SQLite lokal / PostgreSQL in Produktion (via `DATABASE_URL` Env-Var)
  - `create_tables()` — Schema: `trades(id, ticker, strategy, entry_date, exit_date, direction, pnl, ...)`, `backtests(id, ticker, strategy, sharpe, max_dd, ...)`, `risk_snapshots(id, backtest_id, var_95, cvar_95, ...)`
  - `log_backtest(ticker, strategy, trade_stats, trades)` — Speichert Backtest-Run + alle Trades
  - `query_trades(ticker, strategy, date_range) -> DataFrame` — SQL-Queries für Analyse
  - `get_strategy_performance(strategy) -> DataFrame` — Aggregierte Performance über alle Runs
  - Raw SQL für komplexe Queries (JOINs, GROUP BY, Window Functions) — zeigt SQL-Kompetenz
- `backend/main.py` ändern — nach Backtest optional in DB loggen (gated hinter `DATABASE_URL`)
- `backend/requirements.txt` — `sqlalchemy>=2.0.0`, `aiosqlite>=0.19.0`
- **Test:** Backtest laufen → Trades in SQLite → `query_trades()` gibt DataFrame zurück

### Schritt 1.16 — Real-Time Data Stream (Kafka + WebSocket)
> `utils/live_feed.py` erstellen + Frontend WebSocket

- `utils/live_feed.py` — Live-Preis-Stream:
  - `KafkaProducer`: Liest Live-Preise (yfinance Real-Time oder WebSocket von Exchange-API) → schreibt in Kafka Topic `prices.{ticker}`
  - `KafkaConsumer`: Liest aus Kafka Topic → liefert an API
  - Fallback: wenn kein Kafka → direkt yfinance polling (5s Intervall)
- `backend/main.py` — Neuer Endpoint:
  - `GET /api/live/{ticker}` — WebSocket-Endpoint: streamt Live-Preis-Updates ans Frontend
  - `POST /api/live/start` — Startet Live-Feed für einen Ticker
  - `POST /api/live/stop` — Stoppt Live-Feed
- `frontend/src/components/explore/LivePriceChart.tsx` erstellen — Echtzeit-Candlestick-Chart via WebSocket (lightweight-charts, bereits als Dependency vorhanden)
- `frontend/src/app/page.tsx` ändern — "Live" Tab im Explore-Stage
- `infra/docker-compose.yml` ändern — Kafka + Zookeeper Services hinzufügen
- `backend/requirements.txt` — `confluent-kafka>=2.3.0`, `websockets>=12.0`
- **Test:** `docker-compose up` → Live-Feed starten → Frontend zeigt Live-Kerzen → Kafka UI zeigt Messages

### Schritt 1.17 — Automated Test Suite (pytest)
> `tests/` Verzeichnis erstellen

- `tests/conftest.py` — Fixtures: Sample OHLCV DataFrame, Sample Trades, Mock yfinance Session
- `tests/test_indicators.py` — Unit Tests für alle Indikatoren (RSI range 0-100, SMA korrekte Berechnung, etc.)
- `tests/test_strategies.py` — Tests für Signal-Generierung (keine Look-Ahead Bias, korrekte Signal-Shifts)
- `tests/test_backtester.py` — Tests für Backtester (PnL-Berechnung, Position Sizing, Commission)
- `tests/test_risk_analysis.py` — Tests für Risk-Metriken (Sharpe, VaR, Max DD gegen bekannte Werte)
- `tests/test_market_making.py` — Tests für A-S Modell (Reservation Price, Optimal Spread, Inventory Limits)
- `tests/test_order_flow.py` — Tests für OFI, VIR (buy_vol + sell_vol = total_vol)
- `tests/test_purged_cv.py` — Tests: keine Überlappung Train/Test, Embargo korrekt
- `tests/test_api.py` — Integration Tests für alle API-Endpoints (FastAPI TestClient)
- `backend/requirements.txt` — `pytest>=8.0.0`, `pytest-asyncio>=0.23.0`, `httpx>=0.27.0`
- `.github/workflows/fly-deploy.yml` ändern — `pytest` vor Deploy ausführen (CI fails → kein Deploy)
- **Test:** `pytest tests/ -v` → alle Tests grün → GitHub Actions Pipeline grün

### Schritt 1.18 — AWS EC2 Deployment
> Deployment-Skripte

- `infra/aws/user-data.sh` — EC2 Bootstrap (Docker installieren, Repo klonen, docker-compose up)
- **Test:** EC2 Instance starten → App + Grafana + Kafka erreichbar über öffentliche IP

---

## Phase 2: LangGraph AI Agent + RAG (~5 Wochen)

### Schritt 2.1 — Agent-Grundgerüst: LangGraph + State
> `utils/agent/graph.py` + `utils/agent/state.py` erstellen

- `utils/agent/state.py` — `AgentState(TypedDict)`:
  - `messages: list` — Konversationsverlauf
  - `app_context: dict` — Serialisierter App-State (Ticker, Trades, Metriken)
  - `tool_results: list` — Ergebnisse der Tool-Aufrufe
  - `documents: list` — Verfügbare RAG-Dokumente
- `utils/agent/graph.py` — LangGraph `StateGraph`:
  - Nodes: `agent` (LLM-Entscheidung), `tools` (Tool-Ausführung), `respond` (finale Antwort)
  - Edges: agent → tools (wenn Tool-Aufruf nötig) | agent → respond (wenn Antwort bereit)
  - Conditional routing basierend auf LLM-Output
- `utils/agent/prompts.py` — System-Prompt: Finance-Analyst mit Tool-Zugang, injizierter App-Context
- `backend/requirements.txt` — `langchain>=0.3.0`, `langgraph>=0.2.0`, `langchain-anthropic>=0.3.0`
- **Test:** Agent initialisieren → einfache Frage ohne Tools → Antwort kommt zurück

### Schritt 2.2 — Agent Tools: Trading-Aktionen
> `utils/agent/tools.py` erstellen

Der Agent bekommt Tools um eigenständig mit der App zu interagieren:

- `run_backtest_tool(ticker, strategy, period, params)` — Startet einen Backtest, gibt Trade-Stats zurück. Nutzt bestehende `utils/backtester.py`
- `calculate_risk_tool(daily_returns, benchmark)` — Berechnet Risk-Metriken. Nutzt bestehende `utils/risk_analysis.py`
- `fetch_data_tool(ticker, period, interval)` — Holt OHLCV-Daten. Nutzt bestehende `utils/data_fetcher.py`
- `compare_strategies_tool(ticker, strategies, period)` — Vergleicht mehrere Strategien auf gleichen Daten
- `get_indicators_tool(ticker, period, indicators)` — Berechnet technische Indikatoren. Nutzt bestehende `utils/indicators.py`
- `summarize_document_tool(collection, query)` — Fasst relevante Dokument-Abschnitte zusammen (für 10-K Reports)
- Alle Tools als LangChain `@tool` Decorator, mit Pydantic-Schema für Parameter-Validierung
- **Test:** Agent gefragt "Compare SMA Crossover vs Bollinger on AAPL" → Agent ruft `compare_strategies_tool` auf → Multi-Step: fetcht Daten, backtestet beide, vergleicht Ergebnisse

### Schritt 2.3 — Agent: Multi-Step Reasoning
> `utils/agent/graph.py` erweitern

- Mehrschritt-Logik: Agent kann in einem Turn mehrere Tools nacheinander aufrufen
- Beispiel: "Finde die beste Strategie für TSLA" → Agent:
  1. `fetch_data_tool("TSLA", "2y", "1d")`
  2. `run_backtest_tool("TSLA", "SMA Crossover", ...)`
  3. `run_backtest_tool("TSLA", "Bollinger Breakout", ...)`
  4. `run_backtest_tool("TSLA", "ML: LightGBM", ...)`
  5. `calculate_risk_tool(...)` für jede Strategie
  6. Vergleicht und empfiehlt
- Thought/Action/Observation Pattern im Graph
- Max-Iterations Limit (5) gegen Endlosschleifen
- **Test:** Mehrstufige Frage → Agent plant Schritte → führt Tools sequenziell aus → synthetisiert finale Antwort

### Schritt 2.4 — Agent API + Streaming
> `backend/main.py` ändern

- `POST /api/agent/chat` — `AgentChatRequest(messages, state_snapshot)`:
  - Baut `AgentState` aus Frontend State-Snapshot
  - Führt LangGraph-Agent aus
  - Gibt finale Antwort + Tool-Aufrufe-Log zurück
- `POST /api/agent/stream` — SSE-Streaming:
  - Streamt Zwischen-Schritte: "Thinking...", "Running backtest...", "Calculating risk..."
  - Streamt finale Antwort Token für Token
- **Test:** `curl` Request → Agent antwortet mit Tool-Nutzung sichtbar im Response

### Schritt 2.5 — Agent Frontend: Types + Store
> Frontend-Grundlagen

- `frontend/src/types/index.ts` ändern:
  - `ChatMessage { role: "user" | "assistant" | "tool", content: string, timestamp: string, toolName?: string, toolResult?: string }`
  - `AgentStep { type: "thought" | "tool_call" | "tool_result" | "response", content: string }`
- `frontend/src/stores/store.ts` ändern:
  - State: `chatOpen`, `chatMessages`, `chatLoading`, `agentSteps`, `uploadedDocuments`
  - Actions: `toggleChat()`, `sendMessage()`, `clearChat()`, `uploadDocument()`
  - `getStateSnapshot()` — Selector: serialisiert Ticker, TradeStats, RiskMetrics, MLMetrics, completedStages
- **Test:** TypeScript kompiliert fehlerfrei

### Schritt 2.6 — Agent Frontend: Chat-UI
> Neue Chat-Komponenten

- `frontend/src/components/chat/ChatMessage.tsx` — Message-Bubble:
  - User: rechts, blau
  - Assistant: links, grau, Markdown-Rendering
  - Tool-Calls: kompakte Karte mit Icon + Tool-Name + Ergebnis-Summary (einklappbar)
- `frontend/src/components/chat/AgentSteps.tsx` — Zeigt Multi-Step Reasoning:
  - "Thinking..." Indikator
  - Tool-Aufrufe als Timeline: fetch_data → backtest → risk → Antwort
  - Collapsible Details für jedes Tool-Ergebnis
- `frontend/src/components/chat/ChatPanel.tsx` — Rechte Sidebar (360px):
  - Scrollbare Message-History mit AgentSteps
  - Input-Box + Send-Button
  - Streaming-Anzeige
  - Context-Badge: zeigt geladene Stages + Dokumente
  - Suggested Questions je nach Stage
- `frontend/src/components/chat/ChatToggle.tsx` — Toggle-Button (Bot Icon)
- **Test:** Chat öffnen → "Compare RSI and MACD strategies" → Agent-Steps sichtbar → finale Antwort

### Schritt 2.7 — Agent Frontend: Layout-Integration
> Bestehende Dateien ändern

- `frontend/src/components/layout/Header.tsx` ändern — ChatToggle-Button rechts
- `frontend/src/app/page.tsx` ändern — Layout: Main Content schrumpft wenn Chat offen, ChatPanel rechts
- **Test:** Toggle Chat → Layout responsive → Chat neben Analyse nutzbar

---

### Schritt 2.8 — RAG: LangChain Pipeline + PDF
> `utils/rag.py` erstellen

- `load_and_chunk_pdf(file_path, chunk_size=512, overlap=50)` — PDF laden (pypdf), RecursiveCharacterTextSplitter (LangChain)
- `embed_and_store(chunks, collection)` — Sentence Transformers → ChromaDB via LangChain VectorStore
- `create_retriever(collection, k=5)` — LangChain Retriever-Interface
- `build_rag_context(query, collection) -> str` — Retrieved Chunks als Context
- `summarize_document(collection, query) -> str` — LangChain Summarization Chain für 10-K Abschnitte
- `backend/requirements.txt` — `sentence-transformers>=2.2.0`, `chromadb>=0.4.0`, `pypdf>=3.0.0`, `langchain-community>=0.3.0`
- **Test:** AAPL 10-K hochladen → "What are the risk factors?" → relevante Chunks + Summary

### Schritt 2.9 — RAG: API + Agent-Integration
> `backend/main.py` ändern + `utils/agent/tools.py` erweitern

- `backend/main.py` — Neue Endpoints:
  - `POST /api/documents/upload` — PDF → Chunk → Embed → ChromaDB
  - `GET /api/documents` — Liste hochgeladener Dokumente
  - `DELETE /api/documents/{id}` — Dokument löschen
- `utils/agent/tools.py` — Neue Tools für den Agent:
  - `search_documents_tool(query, collection)` — RAG-Retrieval als Agent-Tool
  - `summarize_document_tool(collection, section)` — Dokument-Zusammenfassung als Tool
- Agent kann jetzt sowohl App-Daten analysieren ALS AUCH Dokumente durchsuchen
- **Test:** PDF hochladen → Agent gefragt "Based on AAPL's 10-K risk factors, how does our backtest perform in those risk scenarios?" → Agent nutzt RAG + Backtest-Tool

### Schritt 2.10 — RAG: Frontend (Upload + Document Manager)
> Frontend-Erweiterungen

- `frontend/src/components/chat/DocumentManager.tsx` — Upload-Area (Drag & Drop), Doc-Chips, Löschen
- `frontend/src/components/chat/ChatPanel.tsx` ändern — DocumentManager über Input-Box, Context-Badge zeigt Docs
- **Test:** PDF hochladen → Agent nutzt Dokument-Wissen in Antworten

---

### Schritt 2.11 — Agent Evaluation Framework
> `utils/agent/evaluation.py` erstellen

Misst Reasoning-Qualität, Reliabilität und Konsistenz des Agents (direkt aus Job-Posting).

- `AgentEvaluator` Klasse:
  - `evaluate_reasoning(test_cases) -> dict` — Misst:
    - **Correctness**: Sind Tool-Aufrufe korrekt parametrisiert?
    - **Completeness**: Hat der Agent alle nötigen Steps gemacht?
    - **Consistency**: Gleiche Frage 3x → gleiche Antwort-Struktur?
  - `evaluate_rag(test_questions, ground_truth) -> dict` — RAGAs-Metriken:
    - Faithfulness, Answer Relevancy, Context Precision
  - `optimize_chunk_size(pdf, sizes=[256, 512, 1024]) -> dict` — Chunk-Size vs. RAG-Metriken
  - `run_benchmark(suite_name) -> dict` — Vordefinierte Test-Suite:
    - "basic_qa": Einfache Fragen zu App-Daten
    - "multi_step": Mehrstufige Analyse-Aufgaben
    - "rag_qa": Dokument-basierte Fragen
    - "edge_cases": Fehlende Daten, ungültige Ticker, etc.
- `backend/main.py` — `POST /api/agent/evaluate` Endpoint
- `backend/requirements.txt` — `ragas>=0.1.0`
- **Test:** Benchmark-Suite laufen lassen → Report mit Scores pro Kategorie

### Schritt 2.12 — Hybrid Search (OpenSearch)
> `utils/hybrid_search.py` erstellen

- `HybridSearcher` Klasse:
  - `bm25_search(query, n=10)` — OpenSearch BM25
  - `vector_search(query, n=10)` — ChromaDB Embedding-Suche
  - `hybrid_search(query, n=10, alpha=0.7)` — Gewichtete Kombination
  - Fallback auf ChromaDB wenn kein OpenSearch
- `utils/rag.py` ändern — `create_retriever()` nutzt HybridSearcher wenn OpenSearch verfügbar
- `backend/requirements.txt` — `opensearch-py>=2.4.0`
- `infra/docker-compose.yml` ändern — OpenSearch Service hinzufügen
- **Test:** Hybrid vs. Pure Vector → Hybrid liefert bessere Results bei Keyword-lastigen Queries

### Schritt 2.13 — Deployment + Polish
> Finale Integration

- `Dockerfile` ändern — ChromaDB-Persistenz, sentence-transformers Model-Cache, LangGraph Dependencies
- `backend/main.py` — `ANTHROPIC_API_KEY` Env-Var Handling
- Agent-UX polieren: Error States, Tool-Call Timeouts, Loading States, leerer State
- **Test:** E2E: Explore → Backtest → Chat → Agent nutzt Tools → PDF Upload → RAG-Frage → Agent-Eval → alles funktioniert

---

## Risiken

- **LightGBM auf macOS ARM**: Installation vorab testen (`pip install lightgbm`)
- **OpenSearch braucht ≥2GB RAM**: EC2 mindestens `t3.medium`
- **Fly.io kann kein InfluxDB/Grafana/Kafka**: Graceful Degradation (No-Op wenn nicht konfiguriert)
- **Kafka Overhead**: Kafka + Zookeeper brauchen ~1GB RAM. Fallback auf direktes Polling wenn kein Kafka
- **LLM-API-Kosten**: Rate-Limiting einbauen, Key als Env-Var
- **LangGraph Complexity**: Agent-Loop kann teuer werden (viele LLM-Calls). Max-Iterations begrenzen
- **sentence-transformers**: ~90MB Download beim ersten Start, im Docker-Build cachen
- **ChromaDB Persistenz**: Docker-Volume nötig, sonst Datenverlust bei Restart
- **yfinance Real-Time Limits**: yfinance ist nicht für echtes Real-Time gebaut. Für Demo reicht 5s-Polling, für Produktion wäre ein Exchange-WebSocket nötig
