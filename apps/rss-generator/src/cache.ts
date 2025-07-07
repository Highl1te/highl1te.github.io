import fs from 'fs/promises';
import path from 'path';
import { NewsArticle } from './types.js';

interface CacheData {
  articles: NewsArticle[];
  lastUpdated: string;
  archivePages: Record<string, string[]>; // URL -> article URLs
}

export class CacheManager {
  private cacheFile: string;
  private cacheDir: string;
  private cacheData: CacheData;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
    this.cacheFile = path.join(cacheDir, 'rss-cache.json');
    this.cacheData = {
      articles: [],
      lastUpdated: new Date().toISOString(),
      archivePages: {}
    };
  }

  async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Try to load existing cache
      try {
        const cacheContent = await fs.readFile(this.cacheFile, 'utf-8');
        const parsedData = JSON.parse(cacheContent);
        
        // Convert date strings back to Date objects
        this.cacheData = {
          ...parsedData,
          articles: parsedData.articles.map((article: any) => ({
            ...article,
            publishedDate: new Date(article.publishedDate)
          }))
        };
        
        console.log(`Loaded cache with ${this.cacheData.articles.length} articles`);
      } catch (error) {
        console.log('No existing cache found, starting fresh');
      }
    } catch (error) {
      console.error('Error initializing cache:', error);
    }
  }

  async saveCache(): Promise<void> {
    try {
      this.cacheData.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.cacheFile, JSON.stringify(this.cacheData, null, 2));
      console.log(`Cache saved with ${this.cacheData.articles.length} articles`);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  getCachedArticles(): NewsArticle[] {
    return this.cacheData.articles;
  }

  getCachedArchivePages(): Record<string, string[]> {
    return this.cacheData.archivePages;
  }

  async updateArticles(articles: NewsArticle[]): Promise<void> {
    this.cacheData.articles = articles;
    await this.saveCache();
  }

  async updateArchivePage(url: string, articleUrls: string[]): Promise<void> {
    this.cacheData.archivePages[url] = articleUrls;
    await this.saveCache();
  }

  isArchivePageCached(url: string): boolean {
    return url in this.cacheData.archivePages;
  }

  getCachedArticleUrls(url: string): string[] {
    return this.cacheData.archivePages[url] || [];
  }

  isCacheStale(maxAgeHours: number = 24): boolean {
    const lastUpdated = new Date(this.cacheData.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursDiff > maxAgeHours;
  }

  async clearCache(): Promise<void> {
    try {
      this.cacheData = {
        articles: [],
        lastUpdated: new Date().toISOString(),
        archivePages: {}
      };
      await this.saveCache();
      console.log('Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  getCacheStats(): { articles: number; archivePages: number; lastUpdated: string } {
    return {
      articles: this.cacheData.articles.length,
      archivePages: Object.keys(this.cacheData.archivePages).length,
      lastUpdated: this.cacheData.lastUpdated
    };
  }
} 