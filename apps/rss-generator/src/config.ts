import { CrawlerConfig, RSSFeedConfig } from './types.js';

export const crawlerConfig: CrawlerConfig = {
  baseUrl: 'https://highspell.com',
  archiveUrl: 'https://highspell.com/news/archives',
  selectors: {
    // Archive page selectors
    archiveLinks: '.news-archive-date-links a[href*="/news/archives/"]', // Links to archive pages
    yearLinks: '.news-archive-date-links.year-links a', // Year links
    monthLinks: '.news-archive-date-links a[href*="/news/archives/"]', // Month links
    articleLinks: '.news-summary-item .news-summary-title a', // Links to individual articles
    articleTitle: '#news-article_title', // Article title on individual pages
    articleContent: '.news-article-text', // Article content
    articleDate: '.news-article-date, .news-summary-type-date', // Publication date
    articleAuthor: '.author, .byline' // Author (optional)
  },
  maxArticles: 100, // Increased to get more articles
  crawlDelay: 1000 // 1 second delay between requests
};

export const rssConfig: RSSFeedConfig = {
  title: 'HighSpell News RSS Feed',
  description: 'Latest news and updates from HighSpell',
  feedUrl: 'https://highlite.dev/rss/highspell.xml',
  siteUrl: 'https://highspell.com',
  language: 'en',
  copyright: '© 2020-2025 HighSpell',
  pubDate: new Date()
}; 