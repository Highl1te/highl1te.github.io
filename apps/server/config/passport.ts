import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { UserModel } from '../models/User.js';

let isPassportConfigured = false;

// Function to configure passport with Discord strategy
export const configurePassport = () => {
  if (isPassportConfigured) return;

  const clientID = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectURI = process.env.DISCORD_REDIRECT_URI;

  if (clientID && clientSecret && redirectURI && 
      clientID !== 'placeholder_client_id' && 
      clientSecret !== 'placeholder_client_secret') {
    
    passport.use(new DiscordStrategy({
      clientID,
      clientSecret,
      callbackURL: redirectURI,
      scope: ['identify']
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await UserModel.findByDiscordId(profile.id);

        if (user) {
          // Update existing user with latest info
          user = await UserModel.update(user.id!, {
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar || undefined,
            email: profile.email
          });
        } else {
          // Create new user
          user = await UserModel.create({
            discord_id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar || undefined,
            email: profile.email
          });
        }

        // Auto-promote admin user based on Discord ID
        const adminDiscordId = process.env.ADMIN_DISCORD_ID;
        
        if (adminDiscordId && profile.id === adminDiscordId && user!.role !== 'admin') {
          user = await UserModel.update(user!.id!, { role: 'admin' });
        }

        return done(null, user!);
      } catch (error) {
        return done(error, false);
      }
    }));
    
    isPassportConfigured = true;
  } else {
    console.warn('Discord OAuth credentials not configured. Authentication will be disabled.');
  }
};

// Check if Discord OAuth is configured
export const isDiscordConfigured = () => {
  const clientID = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  return clientID && clientSecret && 
         clientID !== 'placeholder_client_id' && 
         clientSecret !== 'placeholder_client_secret';
};

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
