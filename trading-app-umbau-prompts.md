# Trading Analytics App – Umbau-Prompt für Claude Code

## Anleitung

Du arbeitest Stufe für Stufe. **Paste immer nur EINE Stufe** in Claude Code.
Teste nach jeder Stufe ob die App läuft (`streamlit run Home.py`), bevor du die nächste Stufe startest.

---

## Stufe 1 – Projektstruktur & Explore-Page

```
Lies zuerst mein CLAUDE.md und analysiere meine komplette Projektstruktur – alle Pages, alle Imports, alle Hilfsfunktionen und Config-Dateien.

Ich baue meine Trading Analytics App komplett um. Der neue Flow hat 5 Stufen, die aufeinander aufbauen. Wir starten mit Stufe 1.

### Neue Projektstruktur

Baue die App auf folgende Multipage-Struktur um:

```
Home.py                        # Landing Page mit App-Überblick und Flow-Erklärung
pages/
  1_📊_Explore.py              # Stufe 1: Ticker-Analyse
  2_📈_Strategy.py             # Stufe 2: Strategie bauen (kommt in nächster Stufe)
  3_🔄_Backtest.py             # Stufe 3: Backtest (kommt später)
  4_⚠️_Risk_Analysis.py       # Stufe 4: Risiko (kommt später)
  5_📋_Report.py               # Stufe 5: Zusammenfassung (kommt später)
utils/
  data_fetcher.py              # yfinance Datenabruf, gecacht
  indicators.py                # Technische Indikatoren (pandas-ta)
  fundamentals.py              # Fundamentaldaten
  state_manager.py             # Zentrales st.session_state Management
```

### Was du jetzt umsetzen sollst:

**Home.py:**
- Kurze Beschreibung der App und des 5-Stufen-Flows
- Visueller Flow (z.B. als Schritt-Anzeige: Explore → Strategy → Backtest → Risk → Report)
- Hinweis: User startet bei "Explore"

**utils/state_manager.py:**
- Erstelle eine zentrale Klasse oder Funktionen die den gesamten App-State in st.session_state verwaltet
- Definiere die Datenstruktur die durch alle Stufen fließt:
  - ticker (str)
  - price_data (pd.DataFrame)
  - signals (pd.Series) – Buy/Sell/Hold Zeitreihe
  - backtest_results (dict)
  - risk_metrics (dict)
- Hilfsfunktionen: init_state(), get_state(key), set_state(key, value), is_stage_complete(stage_number)

**utils/data_fetcher.py:**
- Funktion: fetch_price_data(ticker, period) → DataFrame
- Nutze yfinance mit @st.cache_data
- Fehlerbehandlung wenn Ticker nicht existiert

**utils/indicators.py:**
- Funktion: calculate_indicators(df) → DataFrame mit zusätzlichen Spalten
- Nutze pandas-ta für: SMA(20, 50, 200), EMA(12, 26), RSI(14), MACD, Bollinger Bands, ATR(14), Stochastic Oscillator
- Jeder Indikator als eigene Hilfsfunktion, damit Strategy-Page sie einzeln aufrufen kann

**utils/fundamentals.py:**
- Funktion: fetch_fundamentals(ticker) → dict
- Nutze yfinance: P/E, Market Cap, Revenue, EPS, Dividend Yield, 52-Week High/Low

**pages/1_📊_Explore.py:**
- Ticker-Eingabe (Textfeld + die 10 populärsten als Quick-Select Buttons)
- Tab 1 "Price Chart": Interaktiver Plotly Candlestick-Chart mit Volume
- Tab 2 "Technical Indicators": User wählt Indikatoren per Multiselect, werden als Subplots angezeigt
- Tab 3 "Fundamentals": Kennzahlen als übersichtliche Metriken-Karten
- Wenn Ticker geladen: speichere price_data und ticker in session_state via state_manager
- Button unten: "Weiter zu Strategy →" (navigiert zu nächster Page)

### Regeln:
- Nutze ausschließlich: yfinance, pandas-ta, plotly, scikit-learn, streamlit
- Behalte bestehenden nützlichen Code bei wo möglich, aber scheue dich nicht Dinge komplett neu zu schreiben wenn die alte Struktur nicht passt
- Alle Plots mit Plotly (kein matplotlib in der UI)
- Erstelle die Pages 2-5 als Platzhalter mit st.info("Kommt in der nächsten Stufe")
- Aktualisiere requirements.txt
- Teste am Ende ob die App ohne Fehler startet
```

---

## Stufe 2 – Strategy-Page

```
Lies mein CLAUDE.md. Wir setzen Stufe 2 meines Trading Analytics Umbaus um: die Strategy-Page.

### Neue Dateien:
- utils/strategies.py – Strategie-Logik (getrennt von UI)

### utils/strategies.py:

**Regelbasierte Strategien:**
- Jede Strategie ist eine Funktion: strategy_name(df, **params) → pd.Series mit Werten aus {1, -1, 0} (Buy, Sell, Hold)
- Implementiere mindestens:
  - SMA Crossover (fast_period, slow_period)
  - RSI Overbought/Oversold (period, overbought, oversold)
  - MACD Signal Crossover
  - Bollinger Band Breakout
  - Combined: Beliebige Kombination der obigen mit AND/OR Logik

**ML-basierte Strategie:**
- Funktion: ml_strategy(df, features, model_type, train_test_split) → dict mit:
  - signals: pd.Series (Buy/Sell/Hold)
  - model_accuracy: float
  - feature_importance: dict
  - confusion_matrix: array
- Features: User wählt aus den technischen Indikatoren
- Target: Nächster Tag Up/Down (binary classification)
- Modelle via scikit-learn:
  - Random Forest Classifier
  - Gradient Boosting Classifier
  - Logistic Regression
- Train/Test Split: User wählt Prozentsatz (default 80/20)
- Gib Wahrscheinlichkeiten zurück, nicht nur Klassen – User kann Schwellenwert für Signal selbst setzen

### pages/2_📈_Strategy.py:

- Prüfe zuerst: ist Stufe 1 abgeschlossen? (ticker und price_data in session_state?) Wenn nein → Hinweis mit Link zu Explore
- Zeige oben den gewählten Ticker und Zeitraum als Kontext

**Tab 1 "Regelbasiert":**
- Dropdown: Strategie auswählen
- Dynamische Parameter-Inputs je nach gewählter Strategie (Slider für Perioden, Schwellenwerte)
- Button "Signal generieren"
- Zeige: Price Chart mit farbigen Buy/Sell Markern (grün/rot Dreiecke)
- Zeige: Signal-Zusammenfassung (Anzahl Buys, Sells, Holds)

**Tab 2 "Machine Learning":**
- Multiselect: Features wählen (technische Indikatoren)
- Dropdown: Modell wählen
- Slider: Train/Test Split
- Slider: Signal-Schwellenwert (Wahrscheinlichkeit ab der gekauft/verkauft wird)
- Button "Modell trainieren"
- Zeige: Accuracy, Precision, Recall als Metriken
- Zeige: Feature Importance als horizontaler Balken-Chart
- Zeige: Confusion Matrix als Heatmap
- Zeige: Price Chart mit Signalen (wie bei regelbasiert)

- Egal welcher Tab: Signale werden in session_state gespeichert via state_manager
- Button unten: "Weiter zu Backtest →"

### Regeln:
- Strategie-Logik KOMPLETT in utils/strategies.py – die Page macht nur UI
- Keine Data Leakage im ML: Features nur aus Vergangenheitsdaten berechnen
- Zeige Warnungen wenn zu wenig Datenpunkte für gewählte Indikatoren
```

---

## Stufe 3 – Backtest-Page

```
Lies mein CLAUDE.md. Wir setzen Stufe 3 um: die Backtest-Page.

### Neue Dateien:
- utils/backtester.py – Backtest-Engine

### utils/backtester.py:

- Funktion: run_backtest(price_data, signals, initial_capital=10000, position_size="fixed", commission=0.001) → dict
- Position Sizing Optionen:
  - "fixed": Immer 100% des verfügbaren Kapitals
  - "percentage": User-definierter Prozentsatz pro Trade
  - "kelly": Kelly Criterion basierend auf historischer Win-Rate
- Berechne:
  - portfolio_value: pd.Series (täglicher Portfoliowert)
  - trades: List[dict] mit entry_date, exit_date, entry_price, exit_price, return_pct, holding_days
  - cumulative_returns: pd.Series
  - benchmark_returns: pd.Series (S&P 500 im gleichen Zeitraum, via yfinance "^GSPC")
- Trade-Statistiken:
  - total_trades, winning_trades, losing_trades
  - win_rate
  - avg_win, avg_loss
  - profit_factor (gross_wins / gross_losses)
  - max_drawdown (peak to trough)
  - max_drawdown_duration

### pages/3_🔄_Backtest.py:

- Prüfe: Sind Signale aus Stufe 2 vorhanden? Wenn nein → Hinweis
- Zeige Kontext: Ticker, gewählte Strategie, Zeitraum

**Konfiguration (Sidebar oder Expander):**
- Startkapital (Number Input, default 10.000)
- Position Sizing Methode (Dropdown)
- Kommission pro Trade in % (Slider)

**Ergebnisse nach Klick auf "Backtest starten":**
- Metriken-Reihe oben: Total Return, Annualized Return, Max Drawdown, Win Rate, Profit Factor, Sharpe Ratio
- Chart 1: Kumulative Returns – Portfolio vs. S&P 500 (zwei Linien, Plotly)
- Chart 2: Drawdown über Zeit (gefüllter Bereich-Chart)
- Chart 3: Einzelne Trades als Scatter (x=Datum, y=Return%, Farbe=Win/Loss)
- Tabelle: Alle Trades mit Details (sortierbar)

- Speichere backtest_results in session_state
- Button: "Weiter zu Risk Analysis →"

### Regeln:
- Benchmark (S&P 500) muss exakt den gleichen Zeitraum abdecken
- Keine Zukunftsdaten im Backtest (kein Look-Ahead Bias)
- Commission wird bei jedem Buy UND Sell abgezogen
```

---

## Stufe 4 – Risk Analysis Page

```
Lies mein CLAUDE.md. Wir setzen Stufe 4 um: Risk Analysis mit Monte Carlo Simulation.

### Neue Dateien:
- utils/risk_analysis.py – Risiko-Berechnungen

### utils/risk_analysis.py:

**Risiko-Metriken:**
- Funktion: calculate_risk_metrics(portfolio_returns, benchmark_returns, risk_free_rate=0.05) → dict
  - Sharpe Ratio (annualisiert)
  - Sortino Ratio (nur Downside-Volatilität)
  - Max Drawdown (absolut und prozentual)
  - Value at Risk (VaR) – 95% und 99% Konfidenz, historische Methode
  - Conditional VaR (Expected Shortfall)
  - Beta (relativ zum Benchmark)
  - Alpha (Jensen's Alpha)
  - Information Ratio
  - Calmar Ratio

**Monte Carlo Simulation:**
- Funktion: monte_carlo_simulation(portfolio_returns, initial_capital, n_simulations=1000, n_days=252, confidence_levels=[0.05, 0.25, 0.75, 0.95]) → dict
  - simulations: np.array (n_simulations x n_days)
  - percentiles: dict mit Konfidenz-Bändern
  - final_values: Verteilung der Endwerte
  - probability_of_loss: float
  - expected_value: float
  - median_value: float

### pages/4_⚠️_Risk_Analysis.py:

- Prüfe: Backtest-Ergebnisse vorhanden?

**Abschnitt 1 "Risiko-Metriken":**
- Übersichtliche Metriken-Karten in Spalten
- Farbkodierung: Grün = gut, Gelb = mittelmäßig, Rot = problematisch
- Kurze Erklärung unter jeder Metrik (als Tooltip oder Expander)

**Abschnitt 2 "Value at Risk":**
- Histogramm der täglichen Returns mit VaR-Linien eingezeichnet (95% und 99%)
- Interpretation in Klartext: "Mit 95% Sicherheit verlieren Sie an einem Tag nicht mehr als X€"

**Abschnitt 3 "Monte Carlo Simulation":**
- Slider: Anzahl Simulationen (500-5000)
- Slider: Zeithorizont in Tagen (63, 126, 252 = 3M, 6M, 1Y)
- Fan-Chart: Median-Linie + Konfidenz-Bänder (5/25/75/95 Perzentile) als gefüllte Flächen
- Histogramm der Endwerte aller Simulationen
- Metriken: P(Verlust), Erwartungswert, Median, Best Case (95. Perzentil), Worst Case (5. Perzentil)

- Speichere risk_metrics in session_state
- Button: "Weiter zu Report →"
```

---

## Stufe 5 – Report-Page

```
Lies mein CLAUDE.md. Letzte Stufe: die Report/Summary-Page.

### pages/5_📋_Report.py:

- Prüfe: Sind alle vorherigen Stufen abgeschlossen? Zeige Status-Übersicht (✅/❌ pro Stufe)

**Dashboard-Zusammenfassung:**
- Header: Ticker, Strategie-Typ, Zeitraum
- Zeile 1: Key Metrics (Total Return, Sharpe, Max Drawdown, Win Rate) als große Zahlen
- Zeile 2: Mini-Charts nebeneinander (Cumulative Returns, Drawdown, Monte Carlo Fan) – kompakte Versionen der Charts aus den vorherigen Seiten
- Zeile 3: Strategie-Details (welche Indikatoren/Modell, Parameter)
- Zeile 4: Bewertung/Fazit
  - Einfaches Ampel-System: Grün/Gelb/Rot basierend auf Sharpe > 1, MaxDD < 20%, Win Rate > 50%
  - Text-Zusammenfassung: "Diese Strategie hat in X Monaten Y% Return erzielt bei einem maximalen Drawdown von Z%"

**Export:**
- Button "Als PDF exportieren" → Nutze plotly .to_image() + reportlab oder einfach st.download_button mit HTML
- Button "Daten als CSV" → Alle Trades + Metriken als Download

### Letzter Schritt:
- Prüfe die gesamte App End-to-End: Starte bei Home, gehe alle 5 Stufen durch
- Stelle sicher dass der State sauber durchgereicht wird
- Aktualisiere mein CLAUDE.md mit der neuen Projektstruktur
- Aktualisiere requirements.txt falls neue Dependencies dazugekommen sind
```

---

## Reihenfolge & Checkliste

Nach jeder Stufe:

- [ ] `streamlit run Home.py` – App startet ohne Fehler?
- [ ] Neue Page funktioniert mit Testdaten (z.B. Ticker "AAPL")?
- [ ] Daten werden korrekt in session_state gespeichert?
- [ ] Navigation zur nächsten Stufe funktioniert?

Erst wenn alles ✅ → nächste Stufe pasten.
