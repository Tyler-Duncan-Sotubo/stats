// src/infrastructure/drizzle/schema/api-keys.schema.ts
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { defaultId } from '../default-id';

/* ============================================================================
   API KEYS
============================================================================ */

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),

    // identity
    name: text('name').notNull(), // "My Afrobeats App"
    email: text('email').notNull(), // owner email
    website: text('website'), // optional — their app/site

    // the key itself
    keyHash: text('key_hash').notNull(), // bcrypt/sha256 hashed
    keyPrefix: text('key_prefix').notNull(), // first 8 chars e.g. "txc_live" — shown in dashboard

    // tier
    tier: text('tier').notNull().default('free'), // free | pro | enterprise

    // rate limits
    dailyLimit: integer('daily_limit').notNull().default(1000),

    // status
    isActive: boolean('is_active').notNull().default(true),
    revokedAt: timestamp('revoked_at'),
    revokedReason: text('revoked_reason'),

    // last seen
    lastUsedAt: timestamp('last_used_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_keys_key_hash_idx').on(t.keyHash),
    uniqueIndex('api_keys_key_prefix_idx').on(t.keyPrefix),
    index('api_keys_email_idx').on(t.email),
    index('api_keys_tier_idx').on(t.tier),
    index('api_keys_is_active_idx').on(t.isActive),
  ],
);

/* ============================================================================
   API KEY USAGE LOGS
============================================================================ */

export const apiKeyUsageLogs = pgTable(
  'api_key_usage_logs',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),

    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),

    endpoint: text('endpoint').notNull(), // e.g. "/v1/artists/:slug"
    method: text('method').notNull(), // GET | POST
    statusCode: integer('status_code'),
    responseMs: integer('response_ms'), // latency tracking

    // request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('api_key_usage_api_key_idx').on(t.apiKeyId),
    index('api_key_usage_created_at_idx').on(t.createdAt),
    index('api_key_usage_endpoint_idx').on(t.endpoint),
    // for daily count queries
    index('api_key_usage_key_date_idx').on(t.apiKeyId, t.createdAt),
  ],
);

/* ============================================================================
   RELATIONS
============================================================================ */

import { relations } from 'drizzle-orm';

export const apiKeysRelations = relations(apiKeys, ({ many }) => ({
  usageLogs: many(apiKeyUsageLogs),
}));

export const apiKeyUsageLogsRelations = relations(
  apiKeyUsageLogs,
  ({ one }) => ({
    apiKey: one(apiKeys, {
      fields: [apiKeyUsageLogs.apiKeyId],
      references: [apiKeys.id],
    }),
  }),
);
