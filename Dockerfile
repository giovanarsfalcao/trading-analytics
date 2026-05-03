# Stage 1: Build Next.js
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# Stage 2: Production
FROM python:3.11-slim
WORKDIR /app
RUN mkdir -p /app/data

RUN apt-get update && apt-get install -y \
    build-essential curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend code
COPY backend/ ./backend/

# Built frontend (standalone)
COPY --from=frontend /app/frontend/.next/standalone ./frontend/
COPY --from=frontend /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend /app/frontend/public ./frontend/public

# Startup script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8080

HEALTHCHECK CMD curl --fail http://localhost:8000/api/health || exit 1

CMD ["./start.sh"]
