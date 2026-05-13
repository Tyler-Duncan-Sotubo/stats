import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { apiKeys } from 'src/infrastructure/drizzle/schema/api-keys.schema';

@Injectable()
export class ApiKeysRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async insert(values: typeof apiKeys.$inferInsert) {
    const [created] = await this.db.insert(apiKeys).values(values).returning();
    return created;
  }

  async findByHash(hash: string) {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);
    return key ?? null;
  }

  async findByEmail(email: string) {
    return this.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        email: apiKeys.email,
        keyPrefix: apiKeys.keyPrefix,
        tier: apiKeys.tier,
        dailyLimit: apiKeys.dailyLimit,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.email, email.toLowerCase()));
  }

  async findAll() {
    return this.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        email: apiKeys.email,
        website: apiKeys.website,
        keyPrefix: apiKeys.keyPrefix,
        tier: apiKeys.tier,
        dailyLimit: apiKeys.dailyLimit,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);
  }

  updateLastUsed(id: string) {
    void this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async revoke(id: string, reason?: string) {
    const [updated] = await this.db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason ?? 'manual revocation',
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();
    return updated ?? null;
  }

  async findById(id: string) {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);
    return key ?? null;
  }

  async findActiveByEmail(email: string) {
    const [key] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.email, email.toLowerCase()))
      .limit(1);
    return key ?? null;
  }
}
