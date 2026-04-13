import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../token.service';

describe('TokenService', () => {
  let service: TokenService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);

    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      role: 'user',
    };

    it('generates access and refresh tokens with configured values', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const map: Record<string, string | number> = {
          JWT_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_EXPIRATION: 1200,
          JWT_REFRESH_EXPIRATION: 604800,
        };
        return map[key];
      });

      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);

      const result = service.generateTokens(user);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        {
          sub: 'user-1',
          email: 'alice@example.com',
          role: 'user',
        },
        {
          secret: 'access-secret',
          expiresIn: 1200,
        },
      );

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        {
          sub: 'user-1',
          email: 'alice@example.com',
          role: 'user',
        },
        {
          secret: 'refresh-secret',
          expiresIn: 604800,
        },
      );

      expect(result).toEqual({
        id: 'user-1',
        email: 'alice@example.com',
        role: 'user',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 1000 + 1200 * 1000,
      });

      nowSpy.mockRestore();
    });

    it('uses fallback expiration values when config is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const map: Record<string, string | undefined> = {
          JWT_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
        };
        return map[key];
      });

      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = service.generateTokens(user);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        {
          secret: 'access-secret',
          expiresIn: 1200,
        },
      );

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        {
          secret: 'refresh-secret',
          expiresIn: 604800,
        },
      );

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        role: user.role,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws when JWT_SECRET is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const map: Record<string, string | number | undefined> = {
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_EXPIRATION: 1200,
          JWT_REFRESH_EXPIRATION: 604800,
        };
        return map[key];
      });

      expect(() => service.generateTokens(user)).toThrow(BadRequestException);
    });

    it('throws when JWT_REFRESH_SECRET is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const map: Record<string, string | number | undefined> = {
          JWT_SECRET: 'access-secret',
          JWT_EXPIRATION: 1200,
          JWT_REFRESH_EXPIRATION: 604800,
        };
        return map[key];
      });

      expect(() => service.generateTokens(user)).toThrow(BadRequestException);
    });
  });

  describe('generateTempToken', () => {
    it('generates a temp token with JWT_SECRET', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'access-secret';
        return undefined;
      });

      mockJwtService.sign.mockReturnValue('temp-token');

      const result = service.generateTempToken({
        id: 'user-1',
        email: 'alice@example.com',
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          email: 'alice@example.com',
        },
        {
          secret: 'access-secret',
          expiresIn: '60m',
        },
      );

      expect(result).toBe('temp-token');
    });

    it('throws when JWT_SECRET is missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() =>
        service.generateTempToken({
          id: 'user-1',
          email: 'alice@example.com',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies the token with JWT_REFRESH_SECRET', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        return undefined;
      });

      const decodedPayload = {
        sub: 'user-1',
        email: 'alice@example.com',
        role: 'user',
      };

      mockJwtService.verify.mockReturnValue(decodedPayload);

      const result = service.verifyRefreshToken('refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('refresh-token', {
        secret: 'refresh-secret',
      });
      expect(result).toEqual(decodedPayload);
    });

    it('throws when JWT_REFRESH_SECRET is missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.verifyRefreshToken('refresh-token')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyTempToken', () => {
    it('verifies the token with JWT_SECRET', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'access-secret';
        return undefined;
      });

      const decodedPayload = {
        sub: 'user-1',
        email: 'alice@example.com',
      };

      mockJwtService.verify.mockReturnValue(decodedPayload);

      const result = service.verifyTempToken('temp-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('temp-token', {
        secret: 'access-secret',
      });
      expect(result).toEqual(decodedPayload);
    });

    it('throws when JWT_SECRET is missing', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => service.verifyTempToken('temp-token')).toThrow(
        BadRequestException,
      );
    });
  });
});
