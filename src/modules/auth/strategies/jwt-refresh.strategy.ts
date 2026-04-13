import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JwtRefreshStrategy handles validation of refresh tokens.
 *
 * It extends Passport's JWT strategy and is registered under the name
 * 'jwt-refresh' so that JwtRefreshGuard can reference it specifically,
 * separate from the regular access token strategy.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      // Refresh tokens are sent in the request body under the 'refreshToken' field,
      // not in the Authorization header like access tokens.
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),

      // We want expired refresh tokens to be rejected, not silently accepted.
      ignoreExpiration: false,

      // Use a separate secret for refresh tokens so that a leaked access token
      // secret cannot be used to forge refresh tokens, and vice versa.
      secretOrKey: config.getOrThrow('JWT_REFRESH_SECRET'),
    });
  }

  /**
   * Called automatically by Passport after the token signature is verified.
   *
   * The payload here is the decoded JWT body. We validate that the subject (sub)
   * field exists, then return a clean user object which Passport attaches to
   * req.user — making it available to the @CurrentUser() decorator downstream.
   */
  validate(payload: { sub: string; email: string; role: string }) {
    if (!payload.sub) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
