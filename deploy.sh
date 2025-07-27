#!/bin/bash

echo "🚀 Starting DXF Visual Ilot Pro Production Deployment"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build application
echo "🔨 Building application..."
npm run build

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip install -r scripts/requirements.txt

# Start database
echo "🗄️ Starting database..."
docker-compose -f docker-compose.prod.yml up -d db redis

# Wait for database
echo "⏳ Waiting for database..."
sleep 10

# Run migrations
echo "🔄 Running database migrations..."
npm run db:push

# Start application
echo "🌟 Starting application..."
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Deployment complete!"
echo "🌐 Application available at: http://localhost"
echo "📊 Health check: http://localhost/api/health"