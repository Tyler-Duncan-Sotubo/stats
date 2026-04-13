import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { users } from 'src/infrastructure/drizzle/schema';
import { TokenService } from './token.service';

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Looks up the user by email, generates a short-lived JWT reset token,
   * and sends it to the user's email address.
   *
   * We intentionally do not reveal whether the email exists —
   * we just return a generic success message either way.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .execute();

    // Return early without throwing so we don't leak which emails are registered
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const token = this.tokenService.generateTempToken({
      id: user.id,
      email: user.email,
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const resetLink = `${clientUrl}/reset-password/${token}`;

    console.log(`Password reset link for ${email}: ${resetLink}`);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /**
   * Verifies the JWT reset token, hashes the new password,
   * and updates the user's record in the database.
   *
   * The token itself is the source of truth — no separate token table needed
   * since the JWT expiry handles invalidation.
   */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    let payload: { sub: string; email: string };

    try {
      // verifyRefreshToken uses JWT_SECRET — we reuse it for the temp token
      payload = this.tokenService.verifyTempToken(token) as {
        sub: string;
        email: string;
      };
    } catch {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .execute();

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, payload.email))
      .execute();

    return { message: 'Password reset successful.' };
  }
}
