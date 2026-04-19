import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

type AuthUser = {
  id: string;
  email: string;
  role: string;
};

type TempTokenUser = {
  id: string;
  email: string;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get a required string config value.
   * Throws immediately if missing.
   */
  private mustGetString(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new BadRequestException(`${key} is missing`);
    }

    return value;
  }

  /**
   * Get a numeric config value or use a fallback.
   */
  private getNumberOrDefault(key: string, defaultValue: number): number {
    const value = this.configService.get<number>(key);
    return Number.isFinite(value as number) ? Number(value) : defaultValue;
  }

  /**
   * Generate the main auth tokens for a logged-in user.
   */
  generateTokens(user: AuthUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessSecret = this.mustGetString('JWT_SECRET');
    const refreshSecret = this.mustGetString('JWT_REFRESH_SECRET');

    const accessExpSeconds = this.getNumberOrDefault('JWT_EXPIRATION', 86500);
    const refreshExpSeconds = this.getNumberOrDefault(
      'JWT_REFRESH_EXPIRATION',
      604800,
    );

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpSeconds,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpSeconds,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
      expiresIn: Date.now() + accessExpSeconds * 1000,
    };
  }

  /**
   * Generate a short-lived token for temporary flows.
   */
  generateTempToken(user: TempTokenUser) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const secret = this.mustGetString('JWT_SECRET');

    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '60m',
    });
  }

  /**
   * Verify and decode a refresh token.
   */
  verifyRefreshToken(token: string) {
    const secret = this.mustGetString('JWT_REFRESH_SECRET');

    return this.jwtService.verify<{
      sub: string;
      email: string;
      role: string;
    }>(token, { secret });
  }

  verifyTempToken(token: string) {
    const secret = this.mustGetString('JWT_SECRET');
    return this.jwtService.verify<{ sub: string; email: string }>(token, {
      secret,
    });
  }
}
