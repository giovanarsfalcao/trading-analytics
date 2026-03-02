# Basis-Image mit Python 3.11 (Slim für geringere Größe)
FROM python:3.11-slim

# Arbeitsverzeichnis im Container festlegen
WORKDIR /app

# System-Abhängigkeiten installieren (falls für Scikit-Learn oder Matplotlib nötig)
RUN apt-get update && apt-get install -y 
    build-essential 
    curl 
    software-properties-common 
    git 
    && rm -rf /var/lib/apt/lists/*

# Anforderungen kopieren und installieren
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Den gesamten Projektcode kopieren
COPY . .

# Streamlit-Port exponieren (Standard ist 8501)
EXPOSE 8501

# Healthcheck für Fly.io hinzufügen
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Start-Befehl für Streamlit
ENTRYPOINT ["streamlit", "run", "app/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
