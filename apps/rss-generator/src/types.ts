export interface NewsArticle {
  title: string;
  url: string;
  content: string;
  publishedDate: Date;
  author?: string;
  category?: string;
}

export interface RSSFeedConfig {
  title: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
  language: string;
  copyright: string;
  pubDate: Date;
}

export interface CrawlerConfig {
  baseUrl: string;
  archiveUrl: string;
  selectors: {
    archiveLinks: string;
    yearLinks: string;
    monthLinks: string;
    articleLinks: string;
    articleTitle: string;
    articleContent: string;
    articleDate: string;
    articleAuthor?: string;
  };
  maxArticles: number;
  crawlDelay: number; // milliseconds
} 