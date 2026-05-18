#!/bin/bash
# Deploy script for VPS - Run locally or via GitHub Actions
# Usage: ./scripts/deploy-vps.sh

set -e

echo "🚀 RetailOps VPS Deploy Script"
echo "=========================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Config
VPS_HOST="${VPS_HOST:-data.brandcentral.in}"
VPS_USER="${VPS_USER:-root}"
RETAIL_OPS_DIR="/var/www/retail-ops"

# Parse args
SKIP_PULL=false
RESTART_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-pull) SKIP_PULL=true; shift ;;
    --restart-only) RESTART_ONLY=true; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

echo -e "${YELLOW}Connecting to VPS: $VPS_USER@$VPS_HOST${NC}"

ssh "$VPS_USER@$VPS_HOST" << EOF
  set -e
  
  echo "📁 Changing to project directory..."
  cd $RETAIL_OPS_DIR
  
  if [ "$SKIP_PULL" = false ] && [ "$RESTART_ONLY" = false ]; then
    echo "📥 Pulling latest code from Git..."
    git checkout main
    git pull origin main
  
    echo "📦 Installing backend dependencies..."
    cd $RETAIL_OPS_DIR/backend
    npm install
  
    echo "📦 Installing frontend dependencies..."
    cd $RETAIL_OPS_DIR
    npm install --legacy-peer-deps

    echo "⚙️ Building frontend..."
    npm run build
  fi
  
  echo "🔄 Restarting backend with increased memory..."
  cd $RETAIL_OPS_DIR/backend
  
  # Check if PM2 process exists for backend
  if pm2 id retailops-api > /dev/null 2>&1; then
    pm2 restart retailops-api
  else
    pm2 start server.js --name retailops-api -- --max-old-space-size=4096
  fi

  # Check if PM2 process exists for frontend
  echo "🔄 Restarting frontend PM2 process..."
  if pm2 id retailops-frontend > /dev/null 2>&1; then
    pm2 restart retailops-frontend
  else
    pm2 start npm --name "retailops-frontend" -- run preview -- --host --port 4173
  fi
  
  echo "✅ Deployment complete!"
  
  echo ""
  echo "📊 Service Status:"
  pm2 status
  
  echo ""
  echo "📊 Memory Usage:"
  free -h
EOF

echo -e "${GREEN}✅ Deploy completed successfully!${NC}"
echo ""
echo "Backend: https://$VPS_HOST:3001"