import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
if (!REFRESH_TOKEN_SECRET) {
  throw new Error('REFRESH_TOKEN_SECRET environment variable is not set');
}

// In-memory blacklist with TTL auto-cleanup (survives until process restart)
// Key = token hash (first 32 chars), Value = expiry timestamp
const refreshTokenBlacklist = new Map<string, number>();
const BLACKLIST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Auto-cleanup expired entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of refreshTokenBlacklist) {
    if (now > expiry) refreshTokenBlacklist.delete(key);
  }
}, BLACKLIST_CLEANUP_INTERVAL);

function tokenKey(token: string): string {
  // Use first 64 chars as key (unique enough, avoids storing full JWT)
  return token.substring(0, 64);
}

// Account lockout tracking: email → { attempts, lockedUntil }
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  generateAccessToken(user: { id: string; email: string; role: string; tokenVersion?: number }): string {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, tv: user.tokenVersion || 0 },
      ACCESS_TOKEN_SECRET as string,
      { expiresIn: '15m' }
    );
  }

  generateRefreshToken(userId: string, tokenVersion?: number): string {
    return jwt.sign(
      { id: userId, tv: tokenVersion || 0 },
      REFRESH_TOKEN_SECRET as string,
      { expiresIn: '30d' }
    );
  }

  addToBlacklist(token: string): void {
    refreshTokenBlacklist.set(tokenKey(token), Date.now() + REFRESH_TOKEN_TTL);
  }

  isBlacklisted(token: string): boolean {
    const entry = refreshTokenBlacklist.get(tokenKey(token));
    if (!entry) return false;
    if (Date.now() > entry) {
      refreshTokenBlacklist.delete(tokenKey(token));
      return false;
    }
    return true;
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (this.isBlacklisted(refreshToken)) {
      throw { statusCode: 401, message: 'Refresh token has been revoked' };
    }

    let decoded: { id: string; tv?: number };
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as string, { algorithms: ['HS256'] }) as { id: string; tv?: number };
    } catch {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });

    if (!user) {
      throw { statusCode: 401, message: 'User not found' };
    }

    // Check token version — if password was changed, old tokens are invalid
    if ((decoded.tv || 0) < (user.tokenVersion || 0)) {
      throw { statusCode: 401, message: 'Token invalidated due to password change' };
    }

    // Token rotation: blacklist old refresh token, issue new pair
    this.addToBlacklist(refreshToken);

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user.id, user.tokenVersion || 0);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  invalidateRefreshToken(token: string): void {
    this.addToBlacklist(token);
  }

  private checkAccountLockout(email: string): void {
    const record = loginAttempts.get(email);
    if (record && record.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      throw { statusCode: 429, message: `Account locked. Try again in ${minutesLeft} minutes.` };
    }
  }

  private recordFailedLogin(email: string): void {
    const record = loginAttempts.get(email) || { attempts: 0, lockedUntil: 0 };
    record.attempts += 1;
    if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCKOUT_DURATION;
      record.attempts = 0; // reset for next lockout cycle
    }
    loginAttempts.set(email, record);
  }

  private clearFailedLogin(email: string): void {
    loginAttempts.delete(email);
  }

  async register(data: { name: string; email: string; password: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw { statusCode: 409, message: 'Email already registered' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'MEMBER',
      },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    });

    const accessToken = this.generateAccessToken({ ...user, tokenVersion: 0 });
    const refreshToken = this.generateRefreshToken(user.id, 0);
    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    // Check account lockout before anything
    this.checkAccountLockout(email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.recordFailedLogin(email);
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      this.recordFailedLogin(email);
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Login successful — clear failed attempts
    this.clearFailedLogin(email);

    const accessToken = this.generateAccessToken({ id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 });
    const refreshToken = this.generateRefreshToken(user.id, user.tokenVersion || 0);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw { statusCode: 409, message: 'Email already in use' };
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw { statusCode: 400, message: 'Current password is required to change password' };
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isValid) {
        throw { statusCode: 401, message: 'Current password is incorrect' };
      }
      updateData.password = await bcrypt.hash(data.newPassword, 12);
      // Bump token version to invalidate all existing tokens
      updateData.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    });

    return updated;
  }
}
