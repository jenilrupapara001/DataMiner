#!/bin/bash
# RetailOps Deploy Script - Run on VPS
# Usage: ./deploy.sh [options]

set -e

echo "🚀 RetailOps Deploy"
echo "=================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
APP_DIR="/var/www/retailops"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR" # Frontend is in the root directory

# Parse args
BRANCH="main"
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch) BRANCH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) shift ;;
  esac
done

echo -e "${YELLOW}Branch: $BRANCH${NC}"

# =====================
# Start deployment
# =====================

cd "$APP_DIR" || { echo -e "${RED}❌ Could not navigate to APP_DIR ($APP_DIR)${NC}"; exit 1; }

echo "📥 Pulling latest code..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# =====================
# Backend
# =====================
echo ""
echo "🔄 Updating backend..."

cd "$BACKEND_DIR" || { echo -e "${RED}❌ Backend dir not found!${NC}"; exit 1; }
npm install --omit=dev

echo "🚀 Restarting backend..."
pm2 delete retailops-backend 2>/dev/null || true
pm2 start server.js \
  --name retailops-backend \
  --node-args="--max-old-space-size=4096" \
  --update-env

# =====================
# Frontend
# =====================
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "🔄 Building frontend..."
  
  cd "$FRONTEND_DIR" || { echo -e "${RED}❌ Frontend dir not found!${NC}"; exit 1; }
  npm install --legacy-peer-deps
  npm run build
  
  echo "🧹 Clearing old frontend..."
  pm2 delete retailops-frontend 2>/dev/null || true
  
  echo "🚀 Starting frontend preview..."
  # Using preview mode via PM2 is robust for internal use, but can also point to serve or Nginx
  pm2 start npm --name "retailops-frontend" -- run preview -- --host --port 4173
fi

# =====================
# Show status
# =====================
echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
echo ""
pm2 status

echo ""
echo "📊 Memory:"
free -h

echo ""
echo "🌐 Services:"
echo "  Backend:  http://31.97.62.95:3001"
echo "  Frontend: http://31.97.62.95:4173"