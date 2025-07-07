import express, { Request, Response, NextFunction, Router } from 'express';
import passport, { isDiscordConfigured } from '../config/passport.js';

const router: Router = express.Router();

// Middleware to check if user is authenticated via session
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Optional auth middleware
export const optionalAuth = (_req: Request, _res: Response, next: NextFunction): void => {
  // User info is available in req.user if authenticated, otherwise undefined
  next();
};

// Discord OAuth login
router.get('/discord', (req: Request, res: Response): void => {
  if (!isDiscordConfigured()) {
    res.status(503).json({ 
      error: 'Discord authentication is not configured. Please set up your Discord application credentials.' 
    });
    return;
  }
  passport.authenticate('discord')(req, res);
});

// Discord OAuth callback
router.get('/discord/callback', (req: Request, res: Response, _next: NextFunction): void => {
  if (!isDiscordConfigured()) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=not_configured`);
    return;
  }
  
  passport.authenticate('discord', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed` 
  })(req, res, () => {
    // User is now authenticated via session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
  });
});

// Get current user
router.get('/me', (req: Request, res: Response): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  const user = req.user as any;
  res.json({
    success: true,
    user: {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      role: user.role,
      banned: user.banned,
      banned_until: user.banned_until,
      ban_reason: user.ban_reason
    }
  });
});

// Logout
router.post('/logout', (req: Request, res: Response): void => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Status endpoint to check if Discord auth is configured
router.get('/status', (_req: Request, res: Response): void => {
  res.json({
    discord_configured: isDiscordConfigured(),
    message: isDiscordConfigured() 
      ? 'Discord authentication is ready' 
      : 'Discord authentication requires configuration'
  });
});

export default router;