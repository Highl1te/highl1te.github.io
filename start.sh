#!/bin/sh

# Copy client files to shared volume for nginx
echo "Copying client files to shared volume..."
if [ -d "/app/apps/client/dist" ]; then
    echo "Copying from built client dist directory..."
    cp -r /app/apps/client/dist/* /app/client-dist/ 2>/dev/null || echo "Failed to copy from dist"
fi

# Also try copying from the pre-built location
if [ -d "/app/client-dist-temp" ] && [ "$(ls -A /app/client-dist-temp)" ]; then
    echo "Copying from temp client dist directory..."
    cp -r /app/client-dist-temp/* /app/client-dist/ 2>/dev/null || echo "Failed to copy from temp"
fi

# List what's in the client-dist directory
echo "Contents of /app/client-dist:"
ls -la /app/client-dist/

# Start the Node.js server
cd /app/apps/server
echo "Starting server from: $(pwd)"
echo "Environment: NODE_ENV=$NODE_ENV, PORT=$PORT"
exec node dist/index.js
