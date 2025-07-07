#!/bin/sh

# Start the RSS Generator server
cd /app/apps/rss-generator
echo "Starting RSS Generator from: $(pwd)"
echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"
exec node dist/index.js 