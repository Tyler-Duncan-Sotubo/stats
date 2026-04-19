import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { users } from 'src/infrastructure/drizzle/schema';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';

/**
 * AuthService handles all authentication logic including registration,
 * login, and token refresh.
 *
 * It talks directly to the database via Drizzle ORM and delegates
 * all token-related work to TokenService.
 */
@Injectable()
export class AuthService {
  constructor(
    // The Drizzle database instance, injected using a custom provider token.
    // This gives us a typed connection to run queries against.
    @Inject(DRIZZLE) private readonly db: DrizzleDB,

    // TokenService handles JWT creation. We keep it separate from AuthService
    // so that token logic stays in one place and is easy to update independently.
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Registers a new user account.
   *
   * The steps are:
   *   1. Check that the email is not already taken.
   *   2. Hash the plain text password so we never store it raw.
   *   3. Insert the new user into the database.
   *   4. Return a token pair so the user is immediately logged in after registering.
   */
  async register(dto: RegisterDto) {
    // Look for an existing account with this email.
    // We destructure the first result from the array because Drizzle always returns an array.
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .execute();

    // If we found a match, throw a 409 Conflict rather than a generic error.
    // This tells the client clearly that the email is taken, not that something broke.
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // bcrypt.hash takes the plain text password and a salt round count (10 is a safe default).
    // The higher the number, the slower and more secure the hash — but 10 is the standard balance.
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Insert the new user and use .returning() to get back the full inserted row,
    // which we need to generate tokens with the real database-assigned values.
    const [user] = await this.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email,
        role: dto.role ?? 'admin',
        password: hashedPassword,
        location: dto.location,
      })
      .returning()
      .execute();

    // Return an access token and refresh token so the user is logged in immediately.
    return this.tokenService.generateTokens(user);
  }

  /**
   * Logs in an existing user.
   *
   * The steps are:
   *   1. Find the user by email.
   *   2. Compare the provided password against the stored hash.
   *   3. Return a fresh token pair on success.
   *
   * Note: we use the same "Invalid credentials" message for both a missing user
   * and a wrong password. This is intentional — giving different messages for each
   * case would let an attacker probe which emails are registered.
   */
  async login(dto: LoginDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    // bcrypt.compare hashes the incoming password the same way and checks
    // if it matches the stored hash. We never decrypt — bcrypt is one-way.
    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.tokenService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /**
   * Issues a new access token from an existing valid refresh token.
   *
   * By the time this method is called, the JwtRefreshGuard has already
   * validated the refresh token and extracted the user payload from it.
   * So all we need to do here is generate a fresh access token.
   *
   * We intentionally do not return a new refresh token here — the existing
   * one remains valid until it expires on its own.
   */
  refreshToken(user: { id: string; email: string; role: string }) {
    const { accessToken, expiresIn } = this.tokenService.generateTokens(user);
    return { accessToken, expiresIn };
  }

  /**
   * Returns all users from the database.
   *
   * This is a development/debugging utility
   */
  async getUsers() {
    return this.db.select().from(users).execute();
  }
}
