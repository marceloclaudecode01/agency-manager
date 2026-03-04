import { Request, Response } from 'express';
import { SocialService } from './social.service';
import { ApiResponse } from '../../utils/api-response';
import { AuthRequest } from '../../types';
import prisma from '../../config/database';

const socialService = new SocialService();

export class SocialController {
  async checkConnection(req: AuthRequest, res: Response) {
    try {
      const result = await socialService.checkConnection();
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to check connection', error.statusCode || 500);
    }
  }

  async getPageInfo(req: AuthRequest, res: Response) {
    try {
      const data = await socialService.getPageInfo();
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to get page info', error.statusCode || 500);
    }
  }

  async getInsights(req: Request, res: Response) {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'month';
      const data = await socialService.getPageInsights(period);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to get insights', error.statusCode || 500);
    }
  }

  async getPosts(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const data = await socialService.getPosts(limit);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      const status = error.statusCode || 500;
      if (error.fbResponse) console.error('[Social] Facebook error detail:', JSON.stringify(error.fbResponse));
      return ApiResponse.error(res, error.message || 'Failed to get posts', status);
    }
  }

  async getScheduledPosts(req: AuthRequest, res: Response) {
    try {
      const data = await socialService.getScheduledPosts();
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to get scheduled posts', error.statusCode || 500);
    }
  }

  async publishPost(req: AuthRequest, res: Response) {
    try {
      const { message, imageUrl, mediaUrl, mediaType, linkUrl, scheduledTime } = req.body;
      const finalMediaUrl = mediaUrl || imageUrl || null;

      const data = finalMediaUrl
        ? await socialService.publishMediaPost(message, finalMediaUrl, { mediaType, linkUrl, scheduledTime })
        : await socialService.publishPost(message, { linkUrl, scheduledTime });

      return ApiResponse.created(res, data, scheduledTime ? 'Post scheduled successfully' : 'Post published successfully');
    } catch (error: any) {
      if (error.response?.data) console.error('[Social] Facebook publish error:', JSON.stringify(error.response.data));
      return ApiResponse.error(res, error.message || 'Failed to publish post', error.statusCode || 500);
    }
  }

  async deletePost(req: AuthRequest, res: Response) {
    try {
      const postId = req.params['postId'] as string;
      const data = await socialService.deletePost(postId);
      return ApiResponse.success(res, data, 'Post deleted successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to delete post', error.statusCode || 500);
    }
  }

  async getPostComments(req: Request, res: Response) {
    try {
      const postId = req.params['postId'] as string;
      const data = await socialService.getPostComments(postId);
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to get comments', error.statusCode || 500);
    }
  }

  // Multi-page: list clients with Facebook pages configured
  async getPageClients(req: Request, res: Response) {
    try {
      const clients = await prisma.client.findMany({
        where: { facebookPageId: { not: null }, isActive: true },
        select: { id: true, name: true, facebookPageId: true, facebookPageName: true, niche: true, company: true },
        orderBy: { name: 'asc' },
      });
      return ApiResponse.success(res, clients);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to fetch page clients', 500);
    }
  }

  // Multi-page: get page info for a specific client
  async getClientPageInfo(req: Request, res: Response) {
    try {
      const clientId = req.params['clientId'] as string;
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { facebookPageId: true, facebookAccessToken: true, name: true },
      });
      if (!client?.facebookPageId || !client?.facebookAccessToken) {
        return ApiResponse.error(res, 'Client has no Facebook page configured', 404);
      }
      const clientService = new SocialService({
        pageId: client.facebookPageId,
        accessToken: client.facebookAccessToken,
      });
      const data = await clientService.getPageInfo();
      return ApiResponse.success(res, data);
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to get client page info', error.statusCode || 500);
    }
  }

  // Multi-page: publish post to a specific client's page
  async publishClientPost(req: Request, res: Response) {
    try {
      const clientId = req.params['clientId'] as string;
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { facebookPageId: true, facebookAccessToken: true, name: true },
      });
      if (!client?.facebookPageId || !client?.facebookAccessToken) {
        return ApiResponse.error(res, 'Client has no Facebook page configured', 404);
      }
      const clientService = new SocialService({
        pageId: client.facebookPageId,
        accessToken: client.facebookAccessToken,
      });
      const { message, imageUrl, mediaUrl, mediaType, linkUrl, scheduledTime } = req.body;
      const finalMediaUrl = mediaUrl || imageUrl || null;

      const data = finalMediaUrl
        ? await clientService.publishMediaPost(message, finalMediaUrl, { mediaType, linkUrl, scheduledTime })
        : await clientService.publishPost(message, { linkUrl, scheduledTime });

      return ApiResponse.created(res, data, scheduledTime ? 'Post scheduled successfully' : 'Post published successfully');
    } catch (error: any) {
      return ApiResponse.error(res, error.message || 'Failed to publish post to client page', error.statusCode || 500);
    }
  }
}
