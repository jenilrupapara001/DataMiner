#!/bin/bash
# RetailOps First-Time Setup - Run on VPS
# Usage: ./setup-vps.sh

set -e

echo "🔧 RetailOps VPS First-Time Setup"
echo "=============================="

# Config
APP_DIR="/var/www/retailops"
GIT_REPO="https://github.com/jenilrupapara001/DataMiner.git"
BRANCH="main"

# Ask for GitHub repo
echo "Enter your GitHub repo URL [Default: $GIT_REPO]:"
read -r INPUT_REPO
GIT_REPO=${INPUT_REPO:-$GIT_REPO}

echo "📁 Creating directory structure..."
mkdir -p $APP_DIR
cd $APP_DIR

echo "📦 Initializing git..."
git init
git remote add origin $GIT_REPO

echo "📥 Cloning repo..."
git fetch origin
git checkout -b $BRANCH origin/$BRANCH

# =====================
# Backend
# =====================
echo ""
echo "🔧 Setting up backend..."

cd $APP_DIR/backend

echo "📦 Installing backend dependencies..."
npm install

echo "📝 Creating .env file..."
if [ ! -f .env ]; then
  cat > .env << 'EOF'
# MongoDB
MONGO_URI=mongodb://localhost:27017/retailops

# JWT
JWT_SECRET=your-super-secret-key-change-this

# Frontend URL
FRONTEND_URL=https://data.brandcentral.in

# Server
PORT=3001
NODE_ENV=production
EOF
  echo "Created .env - please edit with your values!"
fi

echo "🚀 Starting backend..."
pm2 start server.js \
  --name retailops-backend \
  --node-args="--max-old-space-size=4096" \
  --update-env

# =====================
# Frontend  
# =====================
echo ""
echo "🔧 Setting up frontend..."

cd "$APP_DIR" # Frontend package.json is in the root of the repository

echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps

echo "⚙️ Building frontend..."
npm run build

echo "🚀 Starting frontend..."
pm2 start npm --name "retailops-frontend" -- run preview -- --host --port 4173

# =====================
# Final
# =====================
echo ""
echo "✅ Setup complete!"
echo ""
pm2 status

echo ""
echo "🌐 Your services:"
echo "  Backend:  http://31.97.62.95:3001"
echo "  Frontend: http://31.97.62.95:4173"
echo ""
echo "Next steps:"
echo "  1. Point your domain DNS to server IP"
echo "  2. Set up nginx reverse proxy"
echo "  3. Update .env with production values"