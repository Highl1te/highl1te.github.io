import express, { Request, Response, NextFunction, Router } from 'express';
import { getDatabase } from '../config/database.js';
import { requireAuth } from './auth.js';
import { randomBytes } from 'crypto';

const router: Router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDatabase();
    const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
    
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// Get admin dashboard statistics
router.get('/dashboard', requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    
    // Get overall statistics
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const totalListings = await db.get('SELECT COUNT(*) as count FROM marketplace_listings');
    const activeListings = await db.get('SELECT COUNT(*) as count FROM marketplace_listings WHERE status = "active"');
    const totalTrades = await db.get('SELECT COUNT(*) as count FROM trade_confirmations WHERE status = "completed"');
    const pendingTrades = await db.get('SELECT COUNT(*) as count FROM trade_confirmations WHERE status = "pending"');
    const totalOffers = await db.get('SELECT COUNT(*) as count FROM marketplace_offers');
    
    // Get recent activity
    const recentListings = await db.all(`
      SELECT l.*, u.username 
      FROM marketplace_listings l 
      JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC 
      LIMIT 10
    `);
    
    const recentTrades = await db.all(`
      SELECT tc.*, l.item_id, l.asking_price, 
             seller.username as seller_name, 
             buyer.username as buyer_name
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN users seller ON l.user_id = seller.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      JOIN users buyer ON o.user_id = buyer.id
      ORDER BY tc.created_at DESC
      LIMIT 10
    `);
    
    // Get user growth data for charts
    const userGrowth = await db.all(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    // Get trade volume data
    const tradeVolume = await db.all(`
      SELECT DATE(tc.created_at) as date, COUNT(*) as trades, SUM(l.asking_price) as volume
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      WHERE tc.status = 'completed' AND tc.created_at >= DATE('now', '-30 days')
      GROUP BY DATE(tc.created_at)
      ORDER BY date
    `);
    
    // Get most active users
    const mostActiveUsers = await db.all(`
      SELECT u.username, u.discord_id, 
             COUNT(DISTINCT l.id) as listings_count,
             COUNT(DISTINCT o.id) as offers_count,
             COUNT(DISTINCT tc.id) as completed_trades
      FROM users u
      LEFT JOIN marketplace_listings l ON u.id = l.user_id
      LEFT JOIN marketplace_offers o ON u.id = o.user_id
      LEFT JOIN trade_confirmations tc ON (
        (l.user_id = u.id AND tc.listing_id = l.id) OR
        (o.user_id = u.id AND tc.offer_id = o.id)
      ) AND tc.status = 'completed'
      GROUP BY u.id
      ORDER BY (listings_count + offers_count + completed_trades) DESC
      LIMIT 10
    `);
    
    // Get flagged content (listings with many rejected offers)
    const flaggedContent = await db.all(`
      SELECT l.*, u.username, COUNT(o.id) as rejected_offers
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN marketplace_offers o ON l.id = o.listing_id AND o.status = 'rejected'
      GROUP BY l.id
      HAVING rejected_offers > 3
      ORDER BY rejected_offers DESC
      LIMIT 10
    `);
    
    res.json({
      statistics: {
        totalUsers: totalUsers.count,
        totalListings: totalListings.count,
        activeListings: activeListings.count,
        totalTrades: totalTrades.count,
        pendingTrades: pendingTrades.count,
        totalOffers: totalOffers.count
      },
      recentActivity: {
        recentListings,
        recentTrades
      },
      analytics: {
        userGrowth,
        tradeVolume,
        mostActiveUsers,
        flaggedContent
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get all users with admin controls
router.get('/users', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    
    let whereClause = '';
    let params: any[] = [];
    
    if (search) {
      whereClause = 'WHERE username LIKE ? OR discord_id LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }
    
    const users = await db.all(`
      SELECT u.*, 
             COUNT(DISTINCT l.id) as listings_count,
             COUNT(DISTINCT o.id) as offers_count,
             COUNT(DISTINCT w.id) as warnings_count
      FROM users u
      LEFT JOIN marketplace_listings l ON u.id = l.user_id
      LEFT JOIN marketplace_offers o ON u.id = o.user_id
      LEFT JOIN user_warnings w ON u.id = w.user_id AND w.is_active = 1
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    const totalCount = await db.get(`
      SELECT COUNT(*) as count FROM users ${whereClause}
    `, params);
    
    res.json({
      users,
      pagination: {
        current: page,
        total: Math.ceil(totalCount.count / limit),
        count: totalCount.count
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details with activity
router.get('/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const userId = req.params.id;
    
    const user = await db.get(`
      SELECT u.*, 
             COUNT(DISTINCT l.id) as listings_count,
             COUNT(DISTINCT o.id) as offers_count,
             COUNT(DISTINCT w.id) as warnings_count
      FROM users u
      LEFT JOIN marketplace_listings l ON u.id = l.user_id
      LEFT JOIN marketplace_offers o ON u.id = o.user_id
      LEFT JOIN user_warnings w ON u.id = w.user_id AND w.is_active = 1
      WHERE u.id = ?
      GROUP BY u.id
    `, [userId]);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Get user's recent activity
    const recentListings = await db.all(`
      SELECT * FROM marketplace_listings 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);
    
    const recentOffers = await db.all(`
      SELECT o.*, l.item_id, l.asking_price, u.username as seller_name
      FROM marketplace_offers o
      JOIN marketplace_listings l ON o.listing_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [userId]);
    
    const warnings = await db.all(`
      SELECT w.*, u.username as admin_name
      FROM user_warnings w
      JOIN users u ON w.admin_id = u.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [userId]);
    
    res.json({
      user,
      activity: {
        recentListings,
        recentOffers,
        warnings
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user role
router.put('/users/:id/role', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const userId = req.params.id;
    const { role } = req.body;
    const adminId = (req.user as any).id;
    
    if (!['user', 'moderator', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'role_change', 'user', ?, ?)
    `, [adminId, userId, JSON.stringify({ new_role: role })]);
    
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Ban user
router.post('/users/:id/ban', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const userId = req.params.id;
    const { reason, duration } = req.body; // duration in hours, null for permanent
    const adminId = (req.user as any).id;
    
    let bannedUntil = null;
    if (duration) {
      bannedUntil = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    }
    
    await db.run(`
      UPDATE users 
      SET is_banned = 1, banned_until = ?, ban_reason = ?
      WHERE id = ?
    `, [bannedUntil, reason, userId]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'ban_user', 'user', ?, ?)
    `, [adminId, userId, JSON.stringify({ reason, duration, banned_until: bannedUntil })]);
    
    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user
router.post('/users/:id/unban', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const userId = req.params.id;
    const adminId = (req.user as any).id;
    
    await db.run(`
      UPDATE users 
      SET is_banned = 0, banned_until = NULL, ban_reason = NULL
      WHERE id = ?
    `, [userId]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'unban_user', 'user', ?, ?)
    `, [adminId, userId, JSON.stringify({ action: 'unban' })]);
    
    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Issue warning to user
router.post('/users/:id/warn', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const userId = req.params.id;
    const { warning_type, message } = req.body;
    const adminId = (req.user as any).id;
    
    const warningId = randomBytes(16).toString('hex');
    
    await db.run(`
      INSERT INTO user_warnings (id, user_id, admin_id, warning_type, message)
      VALUES (?, ?, ?, ?, ?)
    `, [warningId, userId, adminId, warning_type, message]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'warn_user', 'user', ?, ?)
    `, [adminId, userId, JSON.stringify({ warning_type, message })]);
    
    res.json({ message: 'Warning issued successfully' });
  } catch (error) {
    console.error('Error issuing warning:', error);
    res.status(500).json({ error: 'Failed to issue warning' });
  }
});

// Get all marketplace listings for admin
router.get('/listings', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    
    let whereClause = '';
    let params: any[] = [];
    
    if (status) {
      whereClause = 'WHERE l.status = ?';
      params = [status];
    }
    
    const listings = await db.all(`
      SELECT l.*, u.username, u.discord_id,
             COUNT(DISTINCT o.id) as offers_count
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN marketplace_offers o ON l.id = o.listing_id AND o.status = 'pending'
      ${whereClause}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    const totalCount = await db.get(`
      SELECT COUNT(*) as count FROM marketplace_listings l ${whereClause}
    `, params);
    
    res.json({
      listings,
      pagination: {
        current: page,
        total: Math.ceil(totalCount.count / limit),
        count: totalCount.count
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Close/Remove listing (admin action)
router.post('/listings/:id/close', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const listingId = req.params.id;
    const { reason } = req.body;
    const adminId = (req.user as any).id;
    
    await db.run(`
      UPDATE marketplace_listings 
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [listingId]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'close_listing', 'listing', ?, ?)
    `, [adminId, listingId, JSON.stringify({ reason })]);
    
    res.json({ message: 'Listing closed successfully' });
  } catch (error) {
    console.error('Error closing listing:', error);
    res.status(500).json({ error: 'Failed to close listing' });
  }
});

// Get all pending trades for admin
router.get('/trades', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const trades = await db.all(`
      SELECT tc.*, 
             l.item_id, l.asking_price, l.quantity,
             seller.username as seller_name, seller.discord_id as seller_discord_id,
             buyer.username as buyer_name, buyer.discord_id as buyer_discord_id,
             o.coin_offer, o.message
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN users seller ON l.user_id = seller.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      JOIN users buyer ON o.user_id = buyer.id
      ORDER BY tc.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const totalCount = await db.get('SELECT COUNT(*) as count FROM trade_confirmations');
    
    res.json({
      trades,
      pagination: {
        current: page,
        total: Math.ceil(totalCount.count / limit),
        count: totalCount.count
      }
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Force close pending trade
router.post('/trades/:id/force-close', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const tradeId = req.params.id;
    const { reason } = req.body;
    const adminId = (req.user as any).id;
    
    // Get trade details
    const trade = await db.get(`
      SELECT tc.*, l.id as listing_id, o.id as offer_id
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      WHERE tc.id = ?
    `, [tradeId]);
    
    if (!trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }
    
    // Cancel the trade
    await db.run(`
      UPDATE trade_confirmations 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [tradeId]);
    
    // Revert listing back to active
    await db.run(`
      UPDATE marketplace_listings 
      SET status = 'active', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [trade.listing_id]);
    
    // Revert offer back to pending
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [trade.offer_id]);
    
    // Log admin action
    await db.run(`
      INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
      VALUES (?, 'force_close_trade', 'trade', ?, ?)
    `, [adminId, tradeId, JSON.stringify({ reason })]);
    
    res.json({ message: 'Trade force-closed successfully' });
  } catch (error) {
    console.error('Error force-closing trade:', error);
    res.status(500).json({ error: 'Failed to force-close trade' });
  }
});

// Get admin action logs
router.get('/actions', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const actions = await db.all(`
      SELECT a.*, u.username as admin_name
      FROM admin_actions a
      JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const totalCount = await db.get('SELECT COUNT(*) as count FROM admin_actions');
    
    res.json({
      actions,
      pagination: {
        current: page,
        total: Math.ceil(totalCount.count / limit),
        count: totalCount.count
      }
    });
  } catch (error) {
    console.error('Error fetching admin actions:', error);
    res.status(500).json({ error: 'Failed to fetch admin actions' });
  }
});

export default router;
