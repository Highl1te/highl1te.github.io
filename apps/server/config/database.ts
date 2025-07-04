import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  // If DATABASE_URL is set, use it; otherwise use relative path from this file
  const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../database.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      discriminator TEXT,
      avatar TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sessions table for JWT blacklisting (optional)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_jti TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create marketplace listings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      asking_price INTEGER NOT NULL,
      accepts_items BOOLEAN DEFAULT 0,
      accepts_partial_offers BOOLEAN DEFAULT 0,
      notes TEXT,
      listing_type TEXT DEFAULT 'selling' CHECK(listing_type IN ('selling', 'buying')),
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create marketplace offers table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_offers (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      coin_offer INTEGER DEFAULT 0,
      quantity_requested INTEGER DEFAULT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create marketplace offer items table (for item-based offers)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_offer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (offer_id) REFERENCES marketplace_offers (id)
    )
  `);

  // Create trade confirmations table for pending trades
  await db.exec(`
    CREATE TABLE IF NOT EXISTS trade_confirmations (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      accepted_quantity INTEGER DEFAULT NULL,
      seller_confirmed BOOLEAN DEFAULT 0,
      buyer_confirmed BOOLEAN DEFAULT 0,
      seller_confirmed_at DATETIME NULL,
      buyer_confirmed_at DATETIME NULL,
      completed_at DATETIME NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offer_id) REFERENCES marketplace_offers (id),
      FOREIGN KEY (listing_id) REFERENCES marketplace_listings (id)
    )
  `);

  // Add listing_type column to existing marketplace_listings table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE marketplace_listings 
      ADD COLUMN listing_type TEXT DEFAULT 'selling' CHECK(listing_type IN ('selling', 'buying'))
    `);
  } catch (error: any) {
    // Column likely already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.warn('Warning: Failed to add listing_type column:', error.message);
    }
  }

  // Add quantity_requested column to existing marketplace_offers table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE marketplace_offers 
      ADD COLUMN quantity_requested INTEGER DEFAULT NULL
    `);
  } catch (error: any) {
    // Column likely already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.warn('Warning: Failed to add quantity_requested column:', error.message);
    }
  }

  // Add accepted_quantity column to existing trade_confirmations table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE trade_confirmations 
      ADD COLUMN accepted_quantity INTEGER DEFAULT NULL
    `);
  } catch (error: any) {
    // Column likely already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.warn('Warning: Failed to add accepted_quantity column:', error.message);
    }
  }

  // Add accepts_partial_offers column to existing marketplace_listings table if it doesn't exist
  try {
    await db.exec(`
      ALTER TABLE marketplace_listings 
      ADD COLUMN accepts_partial_offers BOOLEAN DEFAULT 0
    `);
  } catch (error: any) {
    // Column likely already exists, ignore error
    if (!error.message?.includes('duplicate column name')) {
      console.warn('Warning: Failed to add accepts_partial_offers column:', error.message);
    }
  }

  return db;
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return await initializeDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
