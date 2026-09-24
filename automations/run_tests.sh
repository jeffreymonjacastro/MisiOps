#!/bin/bash

# Este script ejecuta todos los tests automatizados del proyecto (Frontend y Backend)

echo "======================================"
echo "🧪 Ejecutando tests del Frontend (Next.js)"
echo "======================================"
cd frontend || exit
pnpm run test
FRONTEND_STATUS=$?
cd ..

echo "======================================"
echo "🧪 Ejecutando tests del Backend (FastAPI)"
echo "======================================"
cd backend || exit
uv run pytest
BACKEND_STATUS=$?
cd ..

echo "======================================"
if [ $FRONTEND_STATUS -ne 0 ] || [ $BACKEND_STATUS -ne 0 ]; then
  echo "❌ Algunos tests han fallado."
  exit 1
else
  echo "✅ ¡Todos los tests pasaron exitosamente!"
  exit 0
fi
