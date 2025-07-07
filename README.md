# HighLite Website

A modern web application with a Vue.js frontend, Node.js backend, and RSS feed generator for HighSpell news.

## Project Structure

```
Website/
├── apps/
│   ├── client/          # Vue.js frontend application
│   ├── server/          # Node.js backend API
│   └── rss-generator/   # RSS feed generator for HighSpell news
├── packages/
│   └── shared/          # Shared TypeScript utilities
└── nginx/               # Nginx configuration
```

## Features

### Main Application
- **Frontend**: Vue.js 3 with TypeScript, Vite, and modern UI
- **Backend**: Express.js API with authentication and marketplace features
- **Database**: SQLite with Prisma ORM
- **Deployment**: Docker with Nginx reverse proxy

### RSS Generator
- **Purpose**: Crawls HighSpell news archives and generates RSS feeds
- **Features**: 
  - Web scraping with Cheerio
  - RSS 2.0 XML generation
  - REST API endpoints
  - Respectful crawling with delays
  - Caching for performance

## Quick Start

### Development
```bash
# Install dependencies
yarn install

# Start all services in development mode
yarn dev

# Or start individual services
yarn dev:client    # Frontend (port 5173)
yarn dev:server    # Backend API (port 3000)
yarn dev:rss       # RSS Generator (port 3001)
```

### Production
```bash
# Build all applications
yarn build

# Start production servers
yarn start:production  # Main application
yarn start:rss        # RSS generator

# Or use Docker
yarn docker:compose
```

## RSS Feed Generator

The RSS generator crawls the HighSpell news archives at https://highspell.com/news/archives and generates an RSS feed.

### Endpoints
- `GET /rss/highspell.xml` - RSS feed in XML format
- `GET /api/articles` - JSON API with article metadata
- `GET /health` - Health check endpoint

### Configuration
The crawler uses configurable CSS selectors in `apps/rss-generator/src/config.ts` to extract:
- Article titles and content
- Publication dates
- Article URLs
- Author information

### Features
- **Respectful Crawling**: Implements delays between requests
- **Error Handling**: Graceful handling of network issues
- **Content Cleaning**: Truncates and formats content for RSS
- **Caching**: RSS feeds cached for 1 hour
- **User-Agent**: Identifies the crawler properly

## API Documentation

### Main Application
- `GET /api/auth/*` - Authentication endpoints
- `GET /api/marketplace/*` - Marketplace functionality
- `GET /api/admin/*` - Admin features

### RSS Generator
- `GET /rss/highspell.xml` - RSS feed
- `GET /api/articles` - Article metadata
- `GET /health` - Health check

## Deployment

### Docker
```bash
# Build and run with Docker Compose
yarn docker:compose

# Or build manually
yarn docker:build
yarn docker:run
```

### Manual Deployment
```bash
# Build for production
yarn build:production

# Start services
yarn start:production
yarn start:rss
```

## Development

### Adding New Features
1. Create feature branch
2. Implement in appropriate app directory
3. Add tests if applicable
4. Update documentation
5. Submit pull request

### RSS Generator Customization
To modify the RSS generator for different websites:
1. Update selectors in `apps/rss-generator/src/config.ts`
2. Adjust crawler logic in `apps/rss-generator/src/crawler.ts`
3. Test with `yarn debug` in the rss-generator directory

## License

This project is licensed under the MIT License - see the LICENSE file for details. 