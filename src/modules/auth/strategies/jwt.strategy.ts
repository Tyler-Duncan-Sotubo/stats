import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JwtStrategy handles validation of access tokens.
 *
 * This is the default JWT strategy, registered under Passport's default
 * name 'jwt', which JwtAuthGuard uses automatically without needing
 * an explicit strategy name.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Access tokens are sent in the Authorization header as a Bearer token.
      // For example: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Expired access tokens should be rejected outright.
      // The client is expected to use the refresh token to get a new one.
      ignoreExpiration: false,

      // The secret used to verify the token signature.
      // This must match the secret used when the token was originally signed.
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  /**
   * Called automatically by Passport after the token signature is verified.
   *
   * We map the JWT payload to a clean user object which Passport then
   * attaches to req.user, making it available via the @CurrentUser() decorator.
   *
   * Note: unlike the refresh strategy, we don't need to throw here because
   * Passport will have already rejected the request if the token is invalid.
   */
  validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
