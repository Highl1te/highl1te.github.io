# Simplified Docker build for production
FROM node:22.16.0-alpine

WORKDIR /app

# Enable Corepack for proper Yarn version management
RUN corepack enable

# Copy package files
COPY package*.json yarn.lock ./
COPY .yarnrc.yml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/client/package.json ./apps/client/package.json  
COPY apps/server/package.json ./apps/server/package.json

# Set Yarn to use node_modules instead of PnP to avoid peer dependency issues
RUN echo 'nodeLinker: node-modules' >> .yarnrc.yml

# Install dependencies (allow lockfile updates in Docker)
RUN yarn install

# Copy source code and environment files
COPY packages/shared ./packages/shared
COPY apps/client ./apps/client
COPY apps/server ./apps/server
COPY .env ./.env

# Set environment variables for the build
ENV NODE_ENV=production
ENV VITE_API_URL=https://highlite.fanet.dev

# Build all packages
RUN yarn workspace @highlite/shared build
RUN yarn workspace @highlite/client build
RUN yarn workspace @highlite/server build

# Install nginx
RUN apk add --no-cache nginx

# Copy built client files to nginx directory
RUN mkdir -p /usr/share/nginx/html
RUN cp -r apps/client/dist/* /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Create nginx directories
RUN mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx

EXPOSE 80 3000

CMD ["/start.sh"]
