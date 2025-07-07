# RSS Generator for HighSpell News

This app crawls the HighSpell news archives and generates an RSS feed that can be consumed by RSS readers.

## Features

- Crawls HighSpell news archives at https://highspell.com/news/archives
- Extracts article titles, content, dates, and authors
- Generates valid RSS 2.0 XML feed
- Provides REST API endpoints
- Respects crawl delays to be respectful to the source website
- Caches RSS feed for 1 hour

## Endpoints

- `GET /rss/highspell.xml` - RSS feed in XML format
- `GET /api/articles` - JSON API with article metadata
- `GET /health` - Health check endpoint

## Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

## Configuration

The app uses configuration files to define:

- **Crawler settings**: CSS selectors for extracting article data, crawl delays, max articles
- **RSS feed settings**: Title, description, feed URL, site URL, etc.

You may need to adjust the CSS selectors in `src/config.ts` based on the actual HTML structure of the HighSpell website.

## Environment Variables

- `PORT` - Server port (default: 3001)

## Docker

The app can be run in Docker alongside the main application. Update the docker-compose.yml to include this service.

## Notes

- The app respects robots.txt and implements crawl delays
- User-Agent is set to identify the crawler
- Error handling for network issues and parsing problems
- Content is cleaned and truncated for RSS compatibility 