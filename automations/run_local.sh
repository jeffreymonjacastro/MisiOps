#!/bin/bash

# Este script levanta simultáneamente los servidores de Frontend y Backend para desarrollo local.

# Detener los procesos en segundo plano cuando este script sea interrumpido (Ctrl+C)
trap 'echo "Deteniendo servidores..."; kill 0' SIGINT SIGTERM EXIT

echo "======================================"
echo "🚀 Iniciando Backend (FastAPI) en puerto 8000..."
echo "======================================"
cd backend || exit
uv run fastapi dev main.py --port 8000 &
BACKEND_PID=$!
cd ..

echo "======================================"
echo "🚀 Iniciando Frontend (Next.js) en puerto 3000..."
echo "======================================"
cd frontend || exit
pnpm run dev &
FRONTEND_PID=$!
cd ..

echo "======================================"
echo "✅ Servidores en ejecución."
echo "👉 Frontend: http://localhost:3000"
echo "👉 Backend: http://localhost:8000"
echo "Pulsa Ctrl+C para detener ambos servidores."
echo "======================================"

# Esperar indefinidamente a que los procesos en background terminen
wait
