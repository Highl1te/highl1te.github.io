import { getDatabase } from '../config/database.js';

// Input validation helpers
const validateDiscordId = (discordId: string): boolean => {
  return /^\d{17,19}$/.test(discordId);
};

const validateUsername = (username: string): boolean => {
  return username.length > 0 && username.length <= 100;
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

export interface User {
  id?: number;
  discord_id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  email?: string;
  role?: 'user' | 'moderator' | 'admin';
  is_banned?: boolean;
  banned_until?: string;
  ban_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export class UserModel {
  static async findByDiscordId(discordId: string): Promise<User | null> {
    if (!validateDiscordId(discordId)) {
      throw new Error('Invalid Discord ID format');
    }
    
    const db = await getDatabase();
    const user = await db.get(
      'SELECT * FROM users WHERE discord_id = ?',
      [discordId]
    );
    return user || null;
  }

  static async findById(id: number): Promise<User | null> {
    const db = await getDatabase();
    const user = await db.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return user || null;
  }

  static async create(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    // Validate input data
    if (!validateDiscordId(userData.discord_id)) {
      throw new Error('Invalid Discord ID format');
    }
    if (!validateUsername(userData.username)) {
      throw new Error('Invalid username');
    }
    if (userData.email && !validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }
    
    const db = await getDatabase();
    const result = await db.run(
      `INSERT INTO users (discord_id, username, discriminator, avatar, email)
       VALUES (?, ?, ?, ?, ?)`,
      [userData.discord_id, userData.username, userData.discriminator, userData.avatar, userData.email]
    );

    const user = await this.findById(result.lastID!);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  static async update(id: number, userData: Partial<User>): Promise<User | null> {
    const db = await getDatabase();
    
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (userData.username) {
      updateFields.push('username = ?');
      updateValues.push(userData.username);
    }
    if (userData.discriminator) {
      updateFields.push('discriminator = ?');
      updateValues.push(userData.discriminator);
    }
    if (userData.avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateValues.push(userData.avatar);
    }
    if (userData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(userData.email);
    }
    if (userData.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(userData.role);
    }
    if (userData.is_banned !== undefined) {
      updateFields.push('is_banned = ?');
      updateValues.push(userData.is_banned ? 1 : 0);
    }
    if (userData.banned_until !== undefined) {
      updateFields.push('banned_until = ?');
      updateValues.push(userData.banned_until);
    }
    if (userData.ban_reason !== undefined) {
      updateFields.push('ban_reason = ?');
      updateValues.push(userData.ban_reason);
    }

    if (updateFields.length === 0) {
      return await this.findById(id);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await db.run(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    return await this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    return result.changes! > 0;
  }
}
