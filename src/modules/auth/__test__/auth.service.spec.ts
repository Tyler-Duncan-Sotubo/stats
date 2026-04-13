/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import { NotificationsServiceTemp } from '../../notifications/notification.service.temp';

jest.mock('bcryptjs');

const mockTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

const mockUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  password: 'hashed-password',
  role: 'user',
  location: 'lagos',
};

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  query: {
    users: {
      findFirst: jest.fn(),
    },
  },
};

const mockTokenService = {
  generateTokens: jest.fn().mockReturnValue(mockTokens),
};

const mockNotificationsService = {
  sendWelcomeEmail: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: TokenService, useValue: mockTokenService },
        {
          provide: NotificationsServiceTemp,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
    mockTokenService.generateTokens.mockReturnValue(mockTokens);
    mockNotificationsService.sendWelcomeEmail.mockResolvedValue(undefined);
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'plaintext',
      role: 'buyer' as const,
      location: 'London',
    };

    it('creates a user, sends welcome email, and returns tokens when the email is not taken', async () => {
      mockDb.execute
        .mockResolvedValueOnce([]) // SELECT — no existing user
        .mockResolvedValueOnce([mockUser]); // INSERT … RETURNING

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockNotificationsService.sendWelcomeEmail).toHaveBeenCalledWith(
        mockUser.email,
        { name: mockUser.name },
      );
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTokens);
    });

    it('throws ConflictException when the email is already in use', async () => {
      mockDb.execute.mockResolvedValueOnce([mockUser]);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockNotificationsService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('stores the hashed password, not the plain text one', async () => {
      mockDb.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockUser]);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(dto);

      const insertedValues = mockDb.values.mock.calls[0][0];
      expect(insertedValues.password).toBe('hashed-password');
      expect(insertedValues.password).not.toBe('plaintext');
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'alice@example.com', password: 'plaintext' };

    it('returns tokens when credentials are valid', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'plaintext',
        'hashed-password',
      );
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual(mockTokens);
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('returns the same error message for a missing user and a wrong password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      const missingUserError = await service
        .login(dto)
        .catch((e) => e.message as string);

      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const wrongPasswordError = await service
        .login(dto)
        .catch((e) => e.message as string);

      expect(missingUserError).toBe(wrongPasswordError);
    });
  });

  // ─── refreshToken ─────────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    const userPayload = {
      id: 'user-1',
      email: 'alice@example.com',
      role: 'user',
    };

    it('returns a new accessToken and expiresIn', () => {
      const result = service.refreshToken(userPayload);

      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(userPayload);
      expect(result).toEqual({
        accessToken: mockTokens.accessToken,
        expiresIn: mockTokens.expiresIn,
      });
    });

    it('does not include a refreshToken in the response', () => {
      const result = service.refreshToken(userPayload);

      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  // ─── getUsers ────────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('returns all users from the database', async () => {
      const allUsers = [
        mockUser,
        { ...mockUser, id: 'user-2', email: 'bob@example.com' },
      ];
      mockDb.execute.mockResolvedValue(allUsers);

      const result = await service.getUsers();

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(allUsers);
    });
  });
});
