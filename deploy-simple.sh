#!/bin/bash

# Simple deployment script for Podman with Cloudflare SSL

set -e

echo "🚀 Starting deployment..."

# Stop existing containers
echo "📦 Stopping existing containers..."
sudo podman-compose down || true

# Build the application
echo "🔨 Building containers..."
sudo podman-compose build

# Start the services
echo "🌟 Starting services..."
sudo podman-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check status
echo "📊 Checking container status..."
sudo podman-compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Place your Cloudflare origin certificates in ./ssl/ directory:"
echo "   - ./ssl/highlite.dev/fullchain.pem"
echo "   - ./ssl/highlite.dev/privkey.pem"
echo ""
echo "2. Check your site:"
echo "   - HTTP: http://highlite.dev"
echo "   - HTTPS: https://highlite.dev (after certificates are in place)"
echo ""
echo "🔍 Useful commands:"
echo "   sudo podman-compose logs nginx     # Check nginx logs"
echo "   sudo podman-compose logs app       # Check app logs"
echo "   sudo podman-compose ps             # Check container status"
