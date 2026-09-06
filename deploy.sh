#!/bin/bash
set -e

cd /app/perfect-entropy

echo "==> Bajando cambios de GitHub..."
git pull origin main

echo "==> Aplicando cambios (recreando backend y caddy)..."
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart backend caddy

echo "==> Limpiando imágenes antiguas..."
docker image prune -f

echo "✅ Deploy completado."
