import express, { Request, Response, Router } from 'express';
import { getDatabase } from '../config/database.js';
import { requireAuth } from './auth.js';
import { randomBytes } from 'crypto';
import { discordNotifications } from '../services/discordNotifications.js';
import itemDefs from '../data/itemdefs.json' with { type: 'json' };

const router: Router = express.Router();

// Middleware to check if user is banned
const checkUserBanned = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return next(); // Let requireAuth handle this
    }

    const db = await getDatabase();
    const user = await db.get(`
      SELECT is_banned, banned_until, ban_reason 
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    if (user && user.is_banned) {
      // Check if temporary ban has expired
      if (user.banned_until && new Date(user.banned_until) < new Date()) {
        // Unban user automatically
        await db.run(`
          UPDATE users 
          SET is_banned = 0, banned_until = NULL, ban_reason = NULL
          WHERE id = ?
        `, [userId]);
        return next();
      }
      
      // User is still banned
      return res.status(403).json({ 
        error: 'Account banned from marketplace',
        reason: user.ban_reason,
        banned_until: user.banned_until
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking ban status:', error);
    next(); // Continue on error to not break the flow
  }
};

// Helper function to get item name by ID
function getItemName(itemId: number): string {
  const item = (itemDefs as any[]).find((item: any) => item._id === itemId);
  return item?.name || 'Unknown Item';
}

// Get all active listings (excluding pending trades)
router.get('/listings', async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const listings = await db.all(`
      SELECT 
        l.*,
        u.username as seller_name,
        u.discord_id as seller_discord_id,
        u.discriminator as seller_discriminator,
        u.avatar as seller_avatar,
        u.created_at as seller_joined_date,
        (SELECT COUNT(*) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as offer_count
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.status = 'active'
      ORDER BY l.listing_type DESC, l.created_at DESC
    `);
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Create a new listing
router.post('/listings', requireAuth, checkUserBanned, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, quantity, askingPrice, acceptsItems, acceptsPartialOffers, listingType, notes } = req.body;
    const userId = (req.user as any)!.id!;

    if (!itemId || !quantity || !askingPrice || !listingType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['selling', 'buying'].includes(listingType)) {
      res.status(400).json({ error: 'Invalid listing type. Must be "selling" or "buying"' });
      return;
    }

    // Validate quantity and asking price
    if ((quantity <= 0 && quantity !== -1) || askingPrice <= 0) {
      res.status(400).json({ error: 'Quantity must be greater than 0 (or -1 for unlimited) and asking price must be greater than 0' });
      return;
    }

    const db = await getDatabase();
    const listingId = randomBytes(16).toString('hex');

    await db.run(`
      INSERT INTO marketplace_listings (id, user_id, item_id, quantity, asking_price, accepts_items, accepts_partial_offers, listing_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [listingId, userId, itemId, quantity, askingPrice, acceptsItems ? 1 : 0, acceptsPartialOffers ? 1 : 0, listingType, notes || '']);

    // Return the created listing with user info
    const listing = await db.get(`
      SELECT 
        l.*,
        u.username as seller_name,
        u.discord_id as seller_discord_id,
        u.discriminator as seller_discriminator,
        u.avatar as seller_avatar,
        u.created_at as seller_joined_date,
        (SELECT COUNT(*) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as offer_count
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [listingId]);

    // Send Discord notification
    try {
      const user = (req.user as any);
      await discordNotifications.notifyListingCreated(
        {
          discordId: user.discord_id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar
        },
        {
          id: listingId,
          itemName: getItemName(itemId),
          quantity,
          askingPrice,
          acceptsItems,
          listingType,
          notes
        }
      );
    } catch (notificationError) {
      console.error('Failed to send Discord notification for listing creation:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json(listing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Update a listing (only by owner)
router.put('/listings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id;
    const userId = (req.user as any)!.id!;
    const { quantity, asking_price, accepts_items, accepts_partial_offers, notes } = req.body;
    const db = await getDatabase();

    // Validate required fields
    if (quantity === undefined || asking_price === undefined) {
      res.status(400).json({ error: 'Missing required fields: quantity and asking_price' });
      return;
    }

    if ((quantity <= 0 && quantity !== -1) || asking_price <= 0) {
      res.status(400).json({ error: 'Quantity must be greater than 0 (or -1 for unlimited) and asking price must be greater than 0' });
      return;
    }

    // Check if listing exists and belongs to user
    const existingListing = await db.get(`
      SELECT * FROM marketplace_listings 
      WHERE id = ? AND user_id = ? AND status = 'active'
    `, [listingId, userId]);

    if (!existingListing) {
      res.status(404).json({ error: 'Listing not found or not authorized' });
      return;
    }

    // Update the listing
    await db.run(`
      UPDATE marketplace_listings 
      SET quantity = ?, asking_price = ?, accepts_items = ?, accepts_partial_offers = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, asking_price, accepts_items ? 1 : 0, accepts_partial_offers ? 1 : 0, notes || '', listingId]);

    // Return the updated listing with user info
    const updatedListing = await db.get(`
      SELECT 
        l.*,
        u.username as seller_name,
        u.discord_id as seller_discord_id,
        u.discriminator as seller_discriminator,
        u.avatar as seller_avatar,
        u.created_at as seller_joined_date,
        (SELECT COUNT(*) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as offer_count
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [listingId]);

    // Send Discord notification
    try {
      const user = (req.user as any);
      await discordNotifications.notifyListingUpdated(
        {
          discordId: user.discord_id,
          username: user.username,
          discriminator: user.discriminator,
          avatar: user.avatar
        },
        {
          id: listingId,
          itemName: getItemName(existingListing.item_id),
          quantity,
          askingPrice: asking_price,
          acceptsItems: accepts_items,
          listingType: existingListing.listing_type,
          notes
        }
      );
    } catch (notificationError) {
      console.error('Failed to send Discord notification for listing update:', notificationError);
      // Don't fail the request if notification fails
    }

    res.json(updatedListing);
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// Delete a listing (only by owner)
router.delete('/listings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id;
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    // Check if listing exists and belongs to user
    const listing = await db.get(`
      SELECT l.*, u.username, u.discord_id, u.discriminator, u.avatar 
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.id = ? AND l.user_id = ? AND l.status = 'active'
    `, [listingId, userId]);

    if (!listing) {
      res.status(404).json({ error: 'Listing not found or not authorized' });
      return;
    }

    // Update listing status to 'removed'
    await db.run(`
      UPDATE marketplace_listings 
      SET status = 'removed', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [listingId]);

    // Send Discord notification
    try {
      await discordNotifications.notifyListingRemoved(
        {
          discordId: listing.discord_id,
          username: listing.username,
          discriminator: listing.discriminator,
          avatar: listing.avatar
        },
        {
          id: listingId,
          itemName: getItemName(listing.item_id),
          quantity: listing.quantity,
          askingPrice: listing.asking_price,
          acceptsItems: listing.accepts_items === 1,
          notes: listing.notes
        }
      );
    } catch (notificationError) {
      console.error('Failed to send Discord notification for listing removal:', notificationError);
    }

    res.json({ message: 'Listing removed successfully' });
  } catch (error) {
    console.error('Error removing listing:', error);
    res.status(500).json({ error: 'Failed to remove listing' });
  }
});

// Get offers for a listing (public endpoint)
router.get('/listings/:id/offers', async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id;
    const db = await getDatabase();

    // Check if listing exists and is active
    const listing = await db.get(`
      SELECT * FROM marketplace_listings 
      WHERE id = ? AND status = 'active'
    `, [listingId]);

    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    // Get offers with user info and offer items (public view)
    const offers = await db.all(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.discord_id as buyer_discord_id,
        u.discriminator as buyer_discriminator,
        u.avatar as buyer_avatar
      FROM marketplace_offers o
      JOIN users u ON o.user_id = u.id
      WHERE o.listing_id = ? AND o.status = 'pending'
      ORDER BY o.created_at DESC
    `, [listingId]);

    // Get offer items for each offer
    for (const offer of offers) {
      const offerItems = await db.all(`
        SELECT * FROM marketplace_offer_items 
        WHERE offer_id = ?
      `, [offer.id]);
      offer.item_offers = offerItems;
    }

    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get offers for a listing (owner management endpoint)
router.get('/listings/:id/offers/manage', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id;
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    // Verify user owns the listing
    const listing = await db.get(`
      SELECT * FROM marketplace_listings 
      WHERE id = ? AND user_id = ?
    `, [listingId, userId]);

    if (!listing) {
      res.status(404).json({ error: 'Listing not found or not authorized' });
      return;
    }

    // Get offers with user info and offer items
    const offers = await db.all(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.discord_id as buyer_discord_id,
        u.discriminator as buyer_discriminator,
        u.avatar as buyer_avatar
      FROM marketplace_offers o
      JOIN users u ON o.user_id = u.id
      WHERE o.listing_id = ? AND o.status = 'pending'
      ORDER BY o.created_at DESC
    `, [listingId]);

    // Get offer items for each offer
    for (const offer of offers) {
      const offerItems = await db.all(`
        SELECT * FROM marketplace_offer_items 
        WHERE offer_id = ?
      `, [offer.id]);
      offer.item_offers = offerItems;
    }

    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Create an offer on a listing
router.post('/listings/:id/offers', requireAuth, checkUserBanned, async (req: Request, res: Response): Promise<void> => {
  try {
    const listingId = req.params.id;
    const userId = (req.user as any)!.id!;
    const { coinOffer, quantityRequested, itemOffers, message } = req.body;
    const db = await getDatabase();

    // Check if listing exists and is active
    const listing = await db.get(`
      SELECT * FROM marketplace_listings 
      WHERE id = ? AND status = 'active'
    `, [listingId]);

    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    // Don't allow offers on own listings
    if (listing.user_id === userId) {
      res.status(400).json({ error: 'Cannot make offers on your own listings' });
      return;
    }

    // Validate quantity_requested if provided
    if (quantityRequested && (quantityRequested <= 0 || quantityRequested > listing.quantity)) {
      res.status(400).json({ error: 'Invalid quantity requested. Must be between 1 and listing quantity.' });
      return;
    }

    const offerId = randomBytes(16).toString('hex');

    // Create the offer
    await db.run(`
      INSERT INTO marketplace_offers (id, listing_id, user_id, coin_offer, quantity_requested, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [offerId, listingId, userId, coinOffer || 0, quantityRequested || null, message || '']);

    // Add item offers if any
    if (itemOffers && itemOffers.length > 0) {
      for (const itemOffer of itemOffers) {
        if (itemOffer.itemId && itemOffer.quantity > 0) {
          await db.run(`
            INSERT INTO marketplace_offer_items (offer_id, item_id, quantity)
            VALUES (?, ?, ?)
          `, [offerId, itemOffer.itemId, itemOffer.quantity]);
        }
      }
    }

    // Return the created offer with user info
    const offer = await db.get(`
      SELECT 
        o.*,
        u.username as buyer_name,
        u.discord_id as buyer_discord_id,
        u.discriminator as buyer_discriminator,
        u.avatar as buyer_avatar
      FROM marketplace_offers o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [offerId]);

    // Get offer items
    const offerItems = await db.all(`
      SELECT * FROM marketplace_offer_items 
      WHERE offer_id = ?
    `, [offerId]);
    offer.item_offers = offerItems;

    // Send Discord notification to listing owner
    try {
      const listingOwner = await db.get(`
        SELECT u.* FROM users u
        JOIN marketplace_listings l ON u.id = l.user_id
        WHERE l.id = ?
      `, [listingId]);

      if (listingOwner) {
        await discordNotifications.notifyOfferReceived(
          {
            discordId: listingOwner.discord_id,
            username: listingOwner.username,
            discriminator: listingOwner.discriminator,
            avatar: listingOwner.avatar
          },
          {
            id: listingId,
            itemName: getItemName(listing.item_id),
            quantity: listing.quantity,
            askingPrice: listing.asking_price,
            acceptsItems: listing.accepts_items === 1,
            notes: listing.notes
          },
          {
            id: offerId,
            listingId: listingId,
            coinOffer: coinOffer || 0,
            message: message || '',
            buyerName: offer.buyer_name,
            buyerDiscordId: offer.buyer_discord_id
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to send Discord notification for new offer:', notificationError);
    }

    res.status(201).json(offer);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// Accept an offer (only by listing owner) - this creates a pending trade
router.post('/offers/:id/accept', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const offerId = req.params.id;
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    // Get offer and verify user owns the listing
    const offer = await db.get(`
      SELECT o.*, l.user_id as listing_owner_id, l.id as listing_id
      FROM marketplace_offers o
      JOIN marketplace_listings l ON o.listing_id = l.id
      WHERE o.id = ? AND l.user_id = ? AND o.status = 'pending'
    `, [offerId, userId]);

    if (!offer) {
      res.status(404).json({ error: 'Offer not found or not authorized' });
      return;
    }

    // Update offer status to accepted
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [offerId]);

    // Update listing status to pending (not sold yet)
    await db.run(`
      UPDATE marketplace_listings 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [offer.listing_id]);

    // Create trade confirmation record - both parties need to verify
    const tradeConfirmationId = randomBytes(16).toString('hex');
    await db.run(`
      INSERT INTO trade_confirmations (id, offer_id, listing_id, seller_confirmed, buyer_confirmed)
      VALUES (?, ?, ?, 0, 0)
    `, [tradeConfirmationId, offerId, offer.listing_id]);

    // Reject all other pending offers for this listing
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
      WHERE listing_id = ? AND id != ? AND status = 'pending'
    `, [offer.listing_id, offerId]);

    // Send Discord notifications
    try {
      // Get listing details and buyer info for notifications
      const listingDetails = await db.get(`
        SELECT l.*, u.discord_id as buyer_discord_id, u.username as buyer_name, u.discriminator as buyer_discriminator, u.avatar as buyer_avatar
        FROM marketplace_listings l
        JOIN marketplace_offers o ON l.id = o.listing_id
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [offerId]);

      if (listingDetails) {
        // Notify buyer that their offer was accepted and trade is pending verification
        await discordNotifications.notifyOfferAccepted(
          {
            discordId: listingDetails.buyer_discord_id,
            username: listingDetails.buyer_name,
            discriminator: listingDetails.buyer_discriminator,
            avatar: listingDetails.buyer_avatar
          },
          {
            id: listingDetails.id,
            itemName: getItemName(listingDetails.item_id),
            quantity: listingDetails.quantity,
            askingPrice: listingDetails.asking_price,
            acceptsItems: listingDetails.accepts_items === 1,
            notes: listingDetails.notes
          },
          {
            id: offerId,
            listingId: offer.listing_id,
            coinOffer: offer.coin_offer,
            message: offer.message,
            buyerName: listingDetails.buyer_name
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to send Discord notification for offer acceptance:', notificationError);
    }

    res.json({ 
      message: 'Offer accepted successfully. Trade is now pending verification from both parties. Please confirm when you have completed the exchange.',
      tradeConfirmationId: tradeConfirmationId 
    });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// Accept a partial offer (only by listing owner) - this creates a pending trade for specified quantity
router.post('/offers/:id/accept-partial', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const offerId = req.params.id;
    const userId = (req.user as any)!.id!;
    const { acceptedQuantity } = req.body;
    const db = await getDatabase();

    if (!acceptedQuantity || acceptedQuantity <= 0) {
      res.status(400).json({ error: 'Accepted quantity must be greater than 0' });
      return;
    }

    // Get offer and verify user owns the listing
    const offer = await db.get(`
      SELECT o.*, l.user_id as listing_owner_id, l.id as listing_id, l.quantity as listing_quantity
      FROM marketplace_offers o
      JOIN marketplace_listings l ON o.listing_id = l.id
      WHERE o.id = ? AND l.user_id = ? AND o.status = 'pending'
    `, [offerId, userId]);

    if (!offer) {
      res.status(404).json({ error: 'Offer not found or not authorized' });
      return;
    }

    // Validate accepted quantity
    const requestedQuantity = offer.quantity_requested || offer.listing_quantity;
    if (acceptedQuantity > requestedQuantity) {
      res.status(400).json({ error: 'Accepted quantity cannot exceed requested quantity' });
      return;
    }

    if (acceptedQuantity > offer.listing_quantity) {
      res.status(400).json({ error: 'Accepted quantity cannot exceed listing quantity' });
      return;
    }

    // Update offer status to accepted
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [offerId]);

    // Update listing quantity - subtract the accepted amount
    const remainingQuantity = offer.listing_quantity - acceptedQuantity;
    if (remainingQuantity > 0) {
      // Update listing with remaining quantity, keep it active
      await db.run(`
        UPDATE marketplace_listings 
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [remainingQuantity, offer.listing_id]);
    } else {
      // If no quantity remains, mark listing as pending
      await db.run(`
        UPDATE marketplace_listings 
        SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [offer.listing_id]);
    }

    // Create trade confirmation record - both parties need to verify
    const tradeConfirmationId = randomBytes(16).toString('hex');
    await db.run(`
      INSERT INTO trade_confirmations (id, offer_id, listing_id, seller_confirmed, buyer_confirmed, accepted_quantity)
      VALUES (?, ?, ?, 0, 0, ?)
    `, [tradeConfirmationId, offerId, offer.listing_id, acceptedQuantity]);

    // For partial acceptance, don't reject other offers - they might still be valid for remaining quantity
    if (remainingQuantity <= 0) {
      // Only reject other offers if no quantity remains
      await db.run(`
        UPDATE marketplace_offers 
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
        WHERE listing_id = ? AND id != ? AND status = 'pending'
      `, [offer.listing_id, offerId]);
    }

    // Send Discord notifications (simplified for now)
    try {
      // Get listing details and buyer info for notifications
      const listingDetails = await db.get(`
        SELECT l.*, u.discord_id as buyer_discord_id, u.username as buyer_name, u.discriminator as buyer_discriminator, u.avatar as buyer_avatar
        FROM marketplace_listings l
        JOIN marketplace_offers o ON l.id = o.listing_id
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [offerId]);

      if (listingDetails && discordNotifications) {
        // Notify buyer that their offer was accepted (partial)
        await discordNotifications.notifyOfferAccepted(
          {
            discordId: listingDetails.buyer_discord_id,
            username: listingDetails.buyer_name,
            discriminator: listingDetails.buyer_discriminator,
            avatar: listingDetails.buyer_avatar
          },
          {
            id: listingDetails.id,
            itemName: getItemName(listingDetails.item_id),
            quantity: acceptedQuantity, // Show accepted quantity, not full listing quantity
            askingPrice: listingDetails.asking_price,
            acceptsItems: listingDetails.accepts_items === 1,
            notes: listingDetails.notes
          },
          {
            id: offerId,
            listingId: offer.listing_id,
            coinOffer: offer.coin_offer,
            message: offer.message,
            buyerName: listingDetails.buyer_name
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to send Discord notification for partial offer acceptance:', notificationError);
    }

    res.json({ 
      message: `Partial offer accepted successfully for ${acceptedQuantity} items. Trade is now pending verification from both parties.`,
      tradeConfirmationId: tradeConfirmationId,
      acceptedQuantity: acceptedQuantity,
      remainingQuantity: remainingQuantity
    });
  } catch (error) {
    console.error('Error accepting partial offer:', error);
    res.status(500).json({ error: 'Failed to accept partial offer' });
  }
});

// Confirm trade completion (by either seller or buyer)
router.post('/trades/:id/confirm', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const tradeConfirmationId = req.params.id;
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    // Get trade confirmation details and verify user is involved
    const tradeConfirmation = await db.get(`
      SELECT tc.*, l.user_id as seller_id, o.user_id as buyer_id, l.id as listing_id, o.id as offer_id
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      WHERE tc.id = ? AND tc.status = 'pending' AND (l.user_id = ? OR o.user_id = ?)
    `, [tradeConfirmationId, userId, userId]);

    if (!tradeConfirmation) {
      res.status(404).json({ error: 'Trade confirmation not found or not authorized' });
      return;
    }

    const isSeller = tradeConfirmation.seller_id === userId;
    const isBuyer = tradeConfirmation.buyer_id === userId;

    // Update confirmation based on who's confirming
    if (isSeller) {
      if (tradeConfirmation.seller_confirmed) {
        res.status(400).json({ error: 'You have already confirmed this trade' });
        return;
      }
      await db.run(`
        UPDATE trade_confirmations 
        SET seller_confirmed = 1, seller_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [tradeConfirmationId]);
    } else if (isBuyer) {
      if (tradeConfirmation.buyer_confirmed) {
        res.status(400).json({ error: 'You have already confirmed this trade' });
        return;
      }
      await db.run(`
        UPDATE trade_confirmations 
        SET buyer_confirmed = 1, buyer_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [tradeConfirmationId]);
    }

    // Check if both parties have now confirmed
    const updatedConfirmation = await db.get(`
      SELECT * FROM trade_confirmations WHERE id = ?
    `, [tradeConfirmationId]);

    if (updatedConfirmation.seller_confirmed && updatedConfirmation.buyer_confirmed) {
      // Both confirmed - complete the trade
      await db.run(`
        UPDATE trade_confirmations 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [tradeConfirmationId]);

      await db.run(`
        UPDATE marketplace_listings 
        SET status = 'sold', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [tradeConfirmation.listing_id]);

      // Send completion notifications
      try {
        const listingDetails = await db.get(`
          SELECT l.*, 
                 seller.discord_id as seller_discord_id, seller.username as seller_name, seller.discriminator as seller_discriminator, seller.avatar as seller_avatar,
                 buyer.discord_id as buyer_discord_id, buyer.username as buyer_name, buyer.discriminator as buyer_discriminator, buyer.avatar as buyer_avatar
          FROM marketplace_listings l
          JOIN users seller ON l.user_id = seller.id
          JOIN marketplace_offers o ON l.id = o.listing_id
          JOIN users buyer ON o.user_id = buyer.id
          WHERE l.id = ? AND o.id = ?
        `, [tradeConfirmation.listing_id, tradeConfirmation.offer_id]);

        if (listingDetails) {
          // Notify both parties of trade completion
          // ... notification logic here
        }
      } catch (notificationError) {
        console.error('Failed to send trade completion notifications:', notificationError);
      }

      res.json({ 
        message: 'Trade completed successfully! Both parties have confirmed the exchange.',
        status: 'completed'
      });
    } else {
      const waitingFor = isSeller ? 'buyer' : 'seller';
      res.json({ 
        message: `Trade confirmation recorded. Waiting for ${waitingFor} to confirm.`,
        status: 'pending',
        waitingFor: waitingFor
      });
    }
  } catch (error) {
    console.error('Error confirming trade:', error);
    res.status(500).json({ error: 'Failed to confirm trade' });
  }
});

// Get pending trades for current user
router.get('/my-pending-trades', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    const pendingTrades = await db.all(`
      SELECT tc.*, 
             l.item_id, l.quantity, l.asking_price, l.accepts_items, l.notes,
             o.coin_offer, o.message,
             seller.username as seller_name, seller.discord_id as seller_discord_id, seller.discriminator as seller_discriminator, seller.avatar as seller_avatar,
             buyer.username as buyer_name, buyer.discord_id as buyer_discord_id, buyer.discriminator as buyer_discriminator, buyer.avatar as buyer_avatar,
             CASE WHEN l.user_id = ? THEN 'seller' ELSE 'buyer' END as user_role
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      JOIN users seller ON l.user_id = seller.id
      JOIN users buyer ON o.user_id = buyer.id
      WHERE (l.user_id = ? OR o.user_id = ?) AND tc.status = 'pending'
      ORDER BY tc.created_at DESC
    `, [userId, userId, userId]);

    // Get offer items for each trade
    for (const trade of pendingTrades) {
      const offerItems = await db.all(`
        SELECT * FROM marketplace_offer_items 
        WHERE offer_id = ?
      `, [trade.offer_id]);
      trade.item_offers = offerItems;
    }

    res.json(pendingTrades);
  } catch (error) {
    console.error('Error fetching pending trades:', error);
    res.status(500).json({ error: 'Failed to fetch pending trades' });
  }
});

// Cancel a pending trade (only if neither party has confirmed yet)
router.post('/trades/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const tradeConfirmationId = req.params.id;
    const userId = (req.user as any)!.id!;
    const db = await getDatabase();

    // Get trade confirmation details and verify user is involved
    const tradeConfirmation = await db.get(`
      SELECT tc.*, l.user_id as seller_id, o.user_id as buyer_id
      FROM trade_confirmations tc
      JOIN marketplace_listings l ON tc.listing_id = l.id
      JOIN marketplace_offers o ON tc.offer_id = o.id
      WHERE tc.id = ? AND tc.status = 'pending' AND (l.user_id = ? OR o.user_id = ?)
    `, [tradeConfirmationId, userId, userId]);

    if (!tradeConfirmation) {
      res.status(404).json({ error: 'Trade confirmation not found or not authorized' });
      return;
    }

    // Allow cancellation only if neither party has confirmed yet
    if (tradeConfirmation.seller_confirmed || tradeConfirmation.buyer_confirmed) {
      res.status(400).json({ error: 'Cannot cancel trade after confirmations have been made' });
      return;
    }

    // Cancel the trade
    await db.run(`
      UPDATE trade_confirmations 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [tradeConfirmationId]);

    // Revert listing back to active
    await db.run(`
      UPDATE marketplace_listings 
      SET status = 'active', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [tradeConfirmation.listing_id]);

    // Revert offer back to pending
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [tradeConfirmation.offer_id]);

    res.json({ message: 'Trade cancelled successfully. Listing is now active again.' });
  } catch (error) {
    console.error('Error cancelling trade:', error);
    res.status(500).json({ error: 'Failed to cancel trade' });
  }
});

// Reject an offer (only by listing owner)
router.post('/offers/:id/reject', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const offerId = req.params.id;
    const userId = (req.user as any).id;
    const db = await getDatabase();

    // Get offer and verify user owns the listing
    const offer = await db.get(`
      SELECT o.*
      FROM marketplace_offers o
      JOIN marketplace_listings l ON o.listing_id = l.id
      WHERE o.id = ? AND l.user_id = ? AND o.status = 'pending'
    `, [offerId, userId]);

    if (!offer) {
      res.status(404).json({ error: 'Offer not found or not authorized' });
      return;
    }

    // Update offer status to rejected
    await db.run(`
      UPDATE marketplace_offers 
      SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [offerId]);

    // Send Discord notification to buyer
    try {
      const offerDetails = await db.get(`
        SELECT o.*, l.*, u.discord_id, u.username, u.discriminator, u.avatar
        FROM marketplace_offers o
        JOIN marketplace_listings l ON o.listing_id = l.id
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [offerId]);

      if (offerDetails) {
        await discordNotifications.notifyOfferRejected(
          {
            discordId: offerDetails.discord_id,
            username: offerDetails.username,
            discriminator: offerDetails.discriminator,
            avatar: offerDetails.avatar
          },
          {
            id: offerDetails.listing_id,
            itemName: getItemName(offerDetails.item_id),
            quantity: offerDetails.quantity,
            askingPrice: offerDetails.asking_price,
            acceptsItems: offerDetails.accepts_items === 1,
            notes: offerDetails.notes
          },
          {
            id: offerId,
            listingId: offerDetails.listing_id,
            coinOffer: offerDetails.coin_offer,
            message: offerDetails.message,
            buyerName: offerDetails.username
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to send Discord notification for offer rejection:', notificationError);
    }

    res.json({ message: 'Offer rejected successfully' });
  } catch (error) {
    console.error('Error rejecting offer:', error);
    res.status(500).json({ error: 'Failed to reject offer' });
  }
});

// Get user's own listings (including pending ones for management)
router.get('/my-listings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const db = await getDatabase();
    
    const listings = await db.all(`
      SELECT 
        l.*,
        u.username as seller_name,
        u.discord_id as seller_discord_id,
        u.discriminator as seller_discriminator,
        u.avatar as seller_avatar,
        u.created_at as seller_joined_date,
        (SELECT COUNT(*) FROM marketplace_offers o WHERE o.listing_id = l.id AND o.status = 'pending') as offer_count
      FROM marketplace_listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.user_id = ? AND l.status IN ('active', 'pending')
      ORDER BY l.created_at DESC
    `, [userId]);
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
});

// Get user's offers
router.get('/my-offers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.user as any).id;
    const db = await getDatabase();
    
    const offers = await db.all(`
      SELECT 
        o.*,
        l.item_id,
        l.quantity as listing_quantity,
        l.asking_price,
        u.username as seller_name
      FROM marketplace_offers o
      JOIN marketplace_listings l ON o.listing_id = l.id
      JOIN users u ON l.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    // Get offer items for each offer
    for (const offer of offers) {
      const offerItems = await db.all(`
        SELECT * FROM marketplace_offer_items 
        WHERE offer_id = ?
      `, [offer.id]);
      offer.item_offers = offerItems;
    }
    
    res.json(offers);
  } catch (error) {
    console.error('Error fetching user offers:', error);
    res.status(500).json({ error: 'Failed to fetch user offers' });
  }
});

// Get seller profile information
router.get('/seller/:discordId', async (req: Request, res: Response): Promise<void> => {
  try {
    const discordId = req.params.discordId;
    const db = await getDatabase();
    
    // Get seller basic info
    const seller = await db.get(`
      SELECT 
        id,
        discord_id,
        username,
        discriminator,
        avatar,
        created_at as joined_date
      FROM users 
      WHERE discord_id = ?
    `, [discordId]);

    if (!seller) {
      res.status(404).json({ error: 'Seller not found' });
      return;
    }

    // Get seller statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_listings,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as total_sales,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings
      FROM marketplace_listings 
      WHERE user_id = ?
    `, [seller.id]);

    // Get seller's active listings
    const listings = await db.all(`
      SELECT 
        l.*
      FROM marketplace_listings l
      WHERE l.user_id = ? AND l.status = 'active'
      ORDER BY l.created_at DESC
      LIMIT 10
    `, [seller.id]);

    // Get recent completed trades (sold listings)
    const recentTrades = await db.all(`
      SELECT 
        l.item_id,
        l.quantity,
        l.asking_price,
        l.updated_at as sold_date
      FROM marketplace_listings l
      WHERE l.user_id = ? AND l.status = 'sold'
      ORDER BY l.updated_at DESC
      LIMIT 5
    `, [seller.id]);

    const profile = {
      ...seller,
      stats: {
        total_listings: stats.total_listings || 0,
        total_sales: stats.total_sales || 0,
        active_listings: stats.active_listings || 0,
        success_rate: stats.total_listings > 0 ? Math.round((stats.total_sales / stats.total_listings) * 100) : 0
      },
      listings,
      recent_trades: recentTrades
    };

    res.json(profile);
  } catch (error) {
    console.error('Error fetching seller profile:', error);
    res.status(500).json({ error: 'Failed to fetch seller profile' });
  }
});

export default router;
