// src/modules/api-keys/guards/api-key.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../api-keys.service';
import { ApiKeyUsageService } from '../api-key-usage.service';
import { CacheService } from 'src/infrastructure/cache/cache.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly apiKeyUsageService: ApiKeyUsageService,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // ── 1. Extract key ──────────────────────────────────────────────────────
    const rawKey = this.extractKey(request);
    if (!rawKey) {
      throw new UnauthorizedException(
        'API key required. Pass it as the Authorization header: Bearer txc_live_...',
      );
    }

    // ── 2. Validate key ─────────────────────────────────────────────────────
    const apiKey = await this.apiKeysService.validate(rawKey);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // ── 3. Rate limit check (Redis) ─────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const redisKey = `api:ratelimit:${apiKey.id}:${today}`;

    const count = await this.cacheService.increment(redisKey);

    if (count === 1) {
      await this.cacheService.expire(redisKey, 86400);
    }

    if (count > apiKey.dailyLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Daily limit of ${apiKey.dailyLimit} requests reached. Resets at midnight UTC.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── 4. Attach key to request ────────────────────────────────────────────
    (request as any).apiKey = apiKey;
    (request as any).apiKeyRequestCount = count;

    // ── 5. Log usage non-blocking ───────────────────────────────────────────
    // api-key.guard.ts
    // api-key.guard.ts
    void this.apiKeyUsageService.log({
      apiKeyId: apiKey.id,
      endpoint: request.url ?? request.originalUrl ?? 'unknown',
      method: request.method,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return true;
  }

  private extractKey(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    const queryKey = request.query?.api_key;
    if (typeof queryKey === 'string' && queryKey.startsWith('txc_live_')) {
      return queryKey;
    }

    return null;
  }
}
