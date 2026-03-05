#!/bin/bash
cd /app && uvicorn api.main:app --host 0.0.0.0 --port 8000 &
cd /app/frontend && PORT=8080 HOSTNAME=0.0.0.0 node server.js &
wait
