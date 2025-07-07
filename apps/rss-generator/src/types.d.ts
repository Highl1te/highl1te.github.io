declare module 'rss' {
  interface RSSOptions {
    title: string;
    description: string;
    feed_url: string;
    site_url: string;
    language: string;
    copyright: string;
    pubDate: Date;
    lastBuildDate: Date;
  }

  interface RSSItemOptions {
    title: string;
    description: string;
    url: string;
    guid?: string;
    categories?: string[];
    author?: string;
    date?: Date;
  }

  class RSS {
    constructor(options: RSSOptions);
    item(options: RSSItemOptions): void;
    xml(options?: { indent?: boolean }): string;
  }

  export = RSS;
} 