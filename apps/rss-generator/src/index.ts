import express from 'express';
import cors from 'cors';
import { NewsCrawler } from './crawler.js';
import { RSSGenerator } from './rss-generator.js';
import { crawlerConfig, rssConfig } from './config.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create instances
const crawler = new NewsCrawler(crawlerConfig);
const rssGenerator = new RSSGenerator(rssConfig);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/rss/highspell.xml', async (req, res) => {
  try {
    console.log('Generating RSS feed for HighSpell news...');
    // Wait for crawl completion to get the most up-to-date articles
    const articles = await crawler.getArticlesWithRevalidation();
    if (articles.length === 0) {
      return res.status(404).json({ 
        error: 'No articles found',
        message: 'Unable to crawl articles from HighSpell archives'
      });
    }
    const rssXml = rssGenerator.generateRSS(articles);
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(rssXml);
    console.log(`RSS feed generated with ${articles.length} articles`);
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).json({ 
      error: 'Failed to generate RSS feed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    // Wait for crawl completion to get the most up-to-date articles
    const articles = await crawler.getArticlesWithRevalidation();
    res.json({
      count: articles.length,
      articles: articles.map(article => ({
        title: article.title,
        url: article.url,
        publishedDate: article.publishedDate,
        author: article.author
      }))
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch articles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = crawler.getCacheStats();
    const lastCrawlTime = crawler.getLastCrawlTime();
    res.json({
      ...stats,
      lastCrawlTime: lastCrawlTime ? lastCrawlTime.toISOString() : null
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/crawl/last', async (req, res) => {
  try {
    const lastCrawlTime = crawler.getLastCrawlTime();
    res.json({
      lastCrawlTime: lastCrawlTime ? lastCrawlTime.toISOString() : null,
      isCrawling: crawler.isCurrentlyCrawling()
    });
  } catch (error) {
    console.error('Error getting last crawl time:', error);
    res.status(500).json({ 
      error: 'Failed to get last crawl time',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/cache/clear', async (req, res) => {
  try {
    await crawler.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Schedule a full crawl every 30 minutes
setInterval(() => {
  console.log('[Scheduler] Triggering scheduled crawl and cache update...');
  crawler.crawlAndUpdateCache?.();
}, 30 * 60 * 1000); // 30 minutes

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.originalUrl} not found` 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`RSS Generator server running on port ${PORT}`);
  console.log(`RSS feed available at: http://localhost:${PORT}/rss/highspell.xml`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Articles API: http://localhost:${PORT}/api/articles`);
}); 