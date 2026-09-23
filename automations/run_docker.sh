#!/bin/bash

# Este script levanta los contenedores del proyecto utilizando Docker Compose

COMPOSE_FILE="docker/docker-compose.yaml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ No se encontró el archivo $COMPOSE_FILE"
    echo "Asegúrate de ejecutar este script desde la raíz del proyecto."
    exit 1
fi

echo "======================================"
echo "🐳 Levantando contenedores con Docker Compose..."
echo "======================================"

# Levanta los contenedores en segundo plano (-d / detached mode)
docker compose -f "$COMPOSE_FILE" up -d

if [ $? -eq 0 ]; then
    echo "======================================"
    echo "✅ Contenedores iniciados correctamente."
    echo ""
    echo "👉 Ver estado de los contenedores:"
    echo "   docker compose -f $COMPOSE_FILE ps"
    echo ""
    echo "👉 Ver logs en tiempo real:"
    echo "   docker compose -f $COMPOSE_FILE logs -f"
    echo ""
    echo "👉 Detener los contenedores:"
    echo "   docker compose -f $COMPOSE_FILE down"
    echo "======================================"
else
    echo "❌ Hubo un error al intentar levantar los contenedores."
    exit 1
fi
