import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { NewsArticle, CrawlerConfig } from './types.js';
import { CacheManager } from './cache.js';

export class NewsCrawler {
  private config: CrawlerConfig;
  private cache: CacheManager;
  private isCrawling = false;
  private lastCrawlTime: Date | null = null;
  private currentCrawlPromise: Promise<void> | null = null;

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.cache = new CacheManager();
  }

  async crawlArchives(): Promise<NewsArticle[]> {
    try {
      console.log('Starting to crawl HighSpell news archives...');
      
      // Initialize cache
      await this.cache.initialize();
      
      // Check if we have fresh cached articles
      if (!this.cache.isCacheStale(24)) {
        const cachedArticles = this.cache.getCachedArticles();
        if (cachedArticles.length > 0) {
          console.log(`Using cached articles (${cachedArticles.length} articles, last updated: ${this.cache.getCacheStats().lastUpdated})`);
          return cachedArticles;
        }
      }
      
      // Fetch the main archives page
      const archivesHtml = await this.fetchPage(this.config.archiveUrl);
      const $ = cheerio.load(archivesHtml);
      
      // Find all years from the year links
      const yearLinks = $(this.config.selectors.archiveLinks);
      const years = new Set<number>();
      yearLinks.each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const match = href.match(/\/news\/archives\/(\d{4})/);
          if (match) {
            years.add(Number(match[1]));
          }
        }
      });
      if (years.size === 0) {
        // Fallback: try to find years in the page text
        const yearMatches = archivesHtml.match(/\/news\/archives\/(\d{4})/g);
        if (yearMatches) {
          yearMatches.forEach(y => {
            const match = y.match(/(\d{4})/);
            if (match) years.add(Number(match[1]));
          });
        }
      }
      if (years.size === 0) {
        throw new Error('No years found in archive page');
      }
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      console.log(`Found years: ${sortedYears.join(', ')}`);
      
      // Generate all /YEAR/1 through /YEAR/12 URLs
      const archiveUrls: string[] = [];
      for (const year of sortedYears) {
        for (let month = 1; month <= 12; month++) {
          archiveUrls.push(`${this.config.baseUrl}/news/archives/${year}/${month}`);
        }
      }
      console.log(`Generated ${archiveUrls.length} archive month URLs to check`);
      
      const articles: NewsArticle[] = [];
      // Process each archive month page
      for (let i = 0; i < archiveUrls.length; i++) {
        const archiveUrl = archiveUrls[i];
        try {
          console.log(`Checking archive page ${i + 1}/${archiveUrls.length}: ${archiveUrl}`);
          const archiveArticles = await this.crawlArchivePage(archiveUrl);
          articles.push(...archiveArticles);
          // Stop if we have enough articles
          if (articles.length >= this.config.maxArticles) {
            articles.splice(this.config.maxArticles);
            break;
          }
          // No delay
        } catch (error) {
          console.error(`Error crawling archive page ${archiveUrl}:`, error);
        }
      }
      // Save articles to cache
      await this.cache.updateArticles(articles);
      console.log(`Successfully crawled ${articles.length} articles`);
      return articles;
    } catch (error) {
      console.error('Error crawling archives:', error);
      throw error;
    }
  }

  private async crawlArchivePage(archiveUrl: string): Promise<NewsArticle[]> {
    try {
      // Check if we have cached article URLs for this archive page
      if (this.cache.isArchivePageCached(archiveUrl)) {
        const cachedArticleUrls = this.cache.getCachedArticleUrls(archiveUrl);
        console.log(`  Using cached article URLs for archive page (${cachedArticleUrls.length} articles)`);
        
        const articles: NewsArticle[] = [];
        const cachedArticles = this.cache.getCachedArticles();
        const cachedArticleMap = new Map(cachedArticles.map(article => [article.url, article]));
        
        for (let i = 0; i < cachedArticleUrls.length; i++) {
          const articleUrl = cachedArticleUrls[i];
          
          // Check if article is already cached
          const cachedArticle = cachedArticleMap.get(articleUrl);
          if (cachedArticle) {
            console.log(`    Using cached article ${i + 1}/${cachedArticleUrls.length}: ${articleUrl}`);
            articles.push(cachedArticle);
          } else {
            try {
              console.log(`    Crawling uncached article ${i + 1}/${cachedArticleUrls.length}: ${articleUrl}`);
              const article = await this.crawlArticle(articleUrl);
              if (article) {
                articles.push(article);
              }
            } catch (error) {
              console.error(`Error crawling uncached article ${articleUrl}:`, error);
            }
          }
        }
        return articles;
      }
      
      // Fetch and parse the archive page
      const html = await this.fetchPage(archiveUrl);
      const $ = cheerio.load(html);
      const articles: NewsArticle[] = [];
      const articleLinks = $(this.config.selectors.articleLinks);
      const articleUrls: string[] = [];
      console.log(`  Found ${articleLinks.length} articles in archive page`);
      
      // Extract article URLs first
      for (let i = 0; i < articleLinks.length; i++) {
        const link = articleLinks.eq(i);
        const href = link.attr('href');
        if (!href) continue;
        const articleUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;
        articleUrls.push(articleUrl);
      }
      
      // Cache the article URLs for this archive page
      await this.cache.updateArchivePage(archiveUrl, articleUrls);
      
      // Check which articles are already cached
      const cachedArticles = this.cache.getCachedArticles();
      const cachedArticleMap = new Map(cachedArticles.map(article => [article.url, article]));
      
      // Process each article link
      for (let i = 0; i < articleUrls.length; i++) {
        const articleUrl = articleUrls[i];
        
        // Check if article is already cached
        const cachedArticle = cachedArticleMap.get(articleUrl);
        if (cachedArticle) {
          console.log(`    Using cached article ${i + 1}/${articleUrls.length}: ${articleUrl}`);
          articles.push(cachedArticle);
        } else {
          try {
            console.log(`    Crawling new article ${i + 1}/${articleUrls.length}: ${articleUrl}`);
            const article = await this.crawlArticle(articleUrl);
            if (article) {
              articles.push(article);
            }
          } catch (error) {
            console.error(`Error crawling new article ${articleUrl}:`, error);
          }
        }
      }
      return articles;
    } catch (error) {
      console.error(`Error crawling archive page ${archiveUrl}:`, error);
      return [];
    }
  }

  private async crawlArticle(url: string): Promise<NewsArticle | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);
      
      const title = $(this.config.selectors.articleTitle).first().text().trim();
      const content = $(this.config.selectors.articleContent).text().trim();
      const dateText = $(this.config.selectors.articleDate).first().text().trim();
      const author = this.config.selectors.articleAuthor 
        ? $(this.config.selectors.articleAuthor).first().text().trim() 
        : undefined;
      
      if (!title || !content) {
        console.warn(`Missing title or content for article: ${url}`);
        return null;
      }
      
      const publishedDate = this.parseDate(dateText) || new Date();
      
      return {
        title,
        url,
        content: this.cleanContent(content),
        publishedDate,
        author
      };
    } catch (error) {
      console.error(`Error crawling article ${url}:`, error);
      return null;
    }
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HighLite-RSS-Generator/1.0 (https://highlite.dev)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  }

  private parseDate(dateText: string): Date | null {
    if (!dateText) return null;
    
    // Handle HighSpell's date format: "Monday, October 9, 2023" or "Game | Monday, October 9, 2023"
    const dateMatch = dateText.match(/(?:.*?\|)?\s*([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (dateMatch) {
      try {
        return new Date(dateMatch[0]);
      } catch {
        // Continue to other formats
      }
    }
    
    // Try various other date formats
    const dateFormats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
    ];
    
    for (const format of dateFormats) {
      const match = dateText.match(format);
      if (match) {
        try {
          return new Date(dateText);
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Expose cache for API endpoints
  getCacheStats() {
    return this.cache.getCacheStats();
  }

  getLastCrawlTime(): Date | null {
    return this.lastCrawlTime;
  }

  isCurrentlyCrawling(): boolean {
    return this.isCrawling;
  }

  async waitForCrawlCompletion(): Promise<void> {
    if (this.currentCrawlPromise) {
      await this.currentCrawlPromise;
    }
  }

  async clearCache() {
    await this.cache.clearCache();
  }

  async getArticlesWithRevalidation(): Promise<NewsArticle[]> {
    await this.cache.initialize();
    const cachedArticles = this.cache.getCachedArticles();
    
    // Start background revalidation if not already running
    if (!this.isCrawling) {
      this.isCrawling = true;
      this.currentCrawlPromise = this.crawlAndUpdateCache().finally(() => {
        this.isCrawling = false;
        this.currentCrawlPromise = null;
      });
    }
    
    // Wait for crawl completion to get the most up-to-date articles
    await this.waitForCrawlCompletion();
    
    // Return the updated articles from cache
    return this.cache.getCachedArticles();
  }

  // Make crawlAndUpdateCache public for scheduler
  async crawlAndUpdateCache(): Promise<void> {
    try {
      console.log('Starting background crawl and cache update...');
      this.lastCrawlTime = new Date();
      
      // Fetch the main archives page to get years and months
      const archivesHtml = await this.fetchPage(this.config.archiveUrl);
      const $ = cheerio.load(archivesHtml);
      
      // Find years from the year-links section
      const yearLinks = $('.news-archive-date-links.year-links a');
      const years = new Set<number>();
      yearLinks.each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const match = href.match(/\/news\/archives\/(\d{4})/);
          if (match) {
            years.add(Number(match[1]));
          }
        }
      });
      
      if (years.size === 0) {
        console.log('No years found in year-links, using fallback range');
        // Fallback: use a reasonable year range
        for (let year = 2020; year <= new Date().getFullYear(); year++) {
          years.add(year);
        }
      }
      
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      console.log(`Found years: ${sortedYears.join(', ')}`);
      
      // For each year, check which months have content
      const archiveUrls: string[] = [];
      
      for (const year of sortedYears) {
        console.log(`Checking months for year ${year}...`);
        
        // Check each month for this year
        for (let month = 1; month <= 12; month++) {
          const monthUrl = `${this.config.baseUrl}/news/archives/${year}/${month}`;
          
          try {
            // Fetch the month page to see if it has articles
            const monthHtml = await this.fetchPage(monthUrl);
            const month$ = cheerio.load(monthHtml);
            const articleLinks = month$(this.config.selectors.articleLinks);
            
            if (articleLinks.length > 0) {
              console.log(`  Year ${year}, Month ${month}: Found ${articleLinks.length} articles`);
              archiveUrls.push(monthUrl);
            }
          } catch (error) {
            console.log(`  Year ${year}, Month ${month}: Error or no content`);
          }
        }
      }
      
      console.log(`Generated ${archiveUrls.length} archive month URLs to check`);
      
      const articles: NewsArticle[] = [];
      for (let i = 0; i < archiveUrls.length; i++) {
        const archiveUrl = archiveUrls[i];
        try {
          console.log(`Checking archive page ${i + 1}/${archiveUrls.length}: ${archiveUrl}`);
          const archiveArticles = await this.crawlArchivePage(archiveUrl);
          articles.push(...archiveArticles);
          if (articles.length >= this.config.maxArticles) {
            articles.splice(this.config.maxArticles);
            break;
          }
        } catch (error) {
          console.error(`Error crawling archive page ${archiveUrl}:`, error);
        }
      }
      
      // Update cache with new articles only
      if (articles.length > 0) {
        const existingArticles = this.cache.getCachedArticles();
        const existingUrls = new Set(existingArticles.map(article => article.url));
        
        // Filter out articles that already exist in cache
        const newArticles = articles.filter(article => !existingUrls.has(article.url));
        
        if (newArticles.length > 0) {
          // Merge new articles with existing ones
          const allArticles = [...existingArticles, ...newArticles];
          await this.cache.updateArticles(allArticles);
          console.log(`Cache updated with ${newArticles.length} new articles (total: ${allArticles.length})`);
        } else {
          console.log('No new articles found, cache unchanged');
        }
      } else {
        console.log('No articles found during crawl');
      }
    } catch (error) {
      console.error('Error during background crawl/revalidate:', error);
    }
  }
} 