#!/bin/bash

# Start backend first and wait for it to be ready
cd /app && uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 2 &

echo "Waiting for backend..."
until curl -sf http://localhost:8000/api/health > /dev/null 2>&1; do
  sleep 1
done
echo "Backend ready."

# Only then start the frontend (which proxies /api/* to port 8000)
cd /app/frontend && PORT=8080 HOSTNAME=0.0.0.0 node server.js &

wait
