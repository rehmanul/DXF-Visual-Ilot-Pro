#!/bin/bash

echo "🚀 Deploying DXF Visual Ilot Pro to Render.com..."

# Build the application
echo "📦 Building application..."
npm run build

# The app will be deployed automatically via Render.com when pushed to GitHub
echo "✅ Build complete. Push to GitHub to deploy to Render.com"
echo "🌐 Your app will be available at: https://dxf-visual-ilot-pro.onrender.com"