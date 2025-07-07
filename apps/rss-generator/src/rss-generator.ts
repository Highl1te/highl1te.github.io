import RSS from 'rss';
import { NewsArticle, RSSFeedConfig } from './types.js';

export class RSSGenerator {
  private config: RSSFeedConfig;

  constructor(config: RSSFeedConfig) {
    this.config = config;
  }

  generateRSS(articles: NewsArticle[]): string {
    const feed = new RSS({
      title: this.config.title,
      description: this.config.description,
      feed_url: this.config.feedUrl,
      site_url: this.config.siteUrl,
      language: this.config.language,
      copyright: this.config.copyright,
      pubDate: this.config.pubDate
    });

    // Sort articles by date (newest first)
    const sortedArticles = articles.sort((a, b) => 
      b.publishedDate.getTime() - a.publishedDate.getTime()
    );

    // Add articles to the feed
    sortedArticles.forEach(article => {
      feed.item({
        title: article.title,
        description: article.content,
        url: article.url,
        guid: article.url,
        categories: article.category ? [article.category] : undefined,
        author: article.author,
        date: article.publishedDate
      });
    });

    // Remove CDATA from the output
    return feed.xml({ indent: true }).replace(/<!\[CDATA\[|\]\]>/g, '');
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    // Try to truncate at a word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
} 