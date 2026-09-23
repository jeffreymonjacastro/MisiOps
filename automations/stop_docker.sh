#!/bin/bash

# Este script detiene y elimina los contenedores del proyecto levantados con Docker Compose.
# Por defecto NO elimina ni los volúmenes de datos ni las imágenes.

COMPOSE_FILE="docker/docker-compose.yaml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ No se encontró el archivo $COMPOSE_FILE"
    echo "Asegúrate de ejecutar este script desde la raíz del proyecto."
    exit 1
fi

DOWN_ARGS=""
if [ "$1" == "--clean" ]; then
    echo "⚠️  Modo de limpieza total activado: se eliminarán los volúmenes de datos."
    DOWN_ARGS="--volumes"
else
    echo "ℹ️  Los volúmenes de datos y las imágenes se conservarán (comportamiento por defecto)."
    echo "   Si deseas eliminar también los volúmenes, ejecuta: $0 --clean"
fi

echo "======================================"
echo "🛑 Deteniendo contenedores con Docker Compose..."
echo "======================================"

# Ejecuta el comando down con los argumentos que correspondan
docker compose -f "$COMPOSE_FILE" down $DOWN_ARGS

if [ $? -eq 0 ]; then
    echo "======================================"
    echo "✅ Contenedores detenidos y eliminados correctamente."
    echo "======================================"
else
    echo "❌ Hubo un error al intentar detener los contenedores."
    exit 1
fi
