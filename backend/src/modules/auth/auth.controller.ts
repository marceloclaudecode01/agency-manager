import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../utils/api-response';
import { AuthRequest } from '../../types';

const authService = new AuthService();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      res.cookie('token', result.token, COOKIE_OPTIONS);
      return ApiResponse.created(res, result, 'User registered successfully');
    } catch (error: any) {
      if (error.statusCode === 409) {
        return ApiResponse.error(res, error.message, 409);
      }
      return ApiResponse.error(res, 'Failed to register user');
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.cookie('token', result.token, COOKIE_OPTIONS);
      return ApiResponse.success(res, result, 'Login successful');
    } catch (error: any) {
      if (error.statusCode === 401) {
        return ApiResponse.unauthorized(res, error.message);
      }
      return ApiResponse.error(res, 'Failed to login');
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie('token', COOKIE_OPTIONS);
    return ApiResponse.success(res, null, 'Logged out successfully');
  }

  async me(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getProfile(req.user!.id);
      return ApiResponse.success(res, user);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return ApiResponse.notFound(res, error.message);
      }
      return ApiResponse.error(res, 'Failed to get profile');
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const user = await authService.updateProfile(req.user!.id, req.body);
      return ApiResponse.success(res, user, 'Profile updated successfully');
    } catch (error: any) {
      if (error.statusCode) {
        return ApiResponse.error(res, error.message, error.statusCode);
      }
      return ApiResponse.error(res, 'Failed to update profile');
    }
  }
}
