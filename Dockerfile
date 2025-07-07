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
COPY apps/rss-generator/package.json ./apps/rss-generator/package.json

# Set Yarn to use node_modules instead of PnP to avoid peer dependency issues
RUN echo 'nodeLinker: node-modules' >> .yarnrc.yml

# Install dependencies (allow lockfile updates in Docker)
RUN yarn install

# Copy source code and environment files
COPY packages/shared ./packages/shared
COPY apps/client ./apps/client
COPY apps/server ./apps/server
COPY apps/rss-generator ./apps/rss-generator
COPY .env ./.env

# Set environment variables for the build
ENV NODE_ENV=production
ENV VITE_API_URL=https://www.highlite.dev

# Build all packages
RUN yarn workspace @highlite/shared build
RUN yarn workspace @highlite/client build
RUN yarn workspace @highlite/server build
RUN yarn workspace @highlite/rss-generator build

# Create directories and copy built files
RUN mkdir -p /app/client-dist-temp
RUN cp -r apps/client/dist/* /app/client-dist-temp/

# Create nginx directories for potential volume mounts
RUN mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx

EXPOSE 3000

# Copy startup scripts
COPY start.sh /start.sh
COPY start-rss.sh /start-rss.sh
RUN chmod +x /start.sh /start-rss.sh

CMD ["/start.sh"]
