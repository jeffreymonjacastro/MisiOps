#!/bin/bash

# Este script clona el proyecto MisiOps y prepara sus dependencias

REPO_URL="https://github.com/jeffreymonjacastro/MisiOps.git"
DEST_DIR="MisiOps"

echo "======================================"
echo "🚀 Clonando el proyecto MisiOps..."
echo "======================================"
git clone "$REPO_URL" "$DEST_DIR"

if [ ! -d "$DEST_DIR" ]; then
    echo "❌ Error al clonar el repositorio."
    exit 1
fi

echo "======================================"
echo "📦 Instalando dependencias del Frontend"
echo "======================================"
cd "$DEST_DIR/frontend" || exit
pnpm install
cd ../..

echo "======================================"
echo "🐍 Instalando dependencias del Backend"
echo "======================================"
cd "$DEST_DIR/backend" || exit
uv sync
cd ../..

echo "======================================"
echo "✅ Proyecto clonado e instalado correctamente en: $DEST_DIR"
echo "======================================"
