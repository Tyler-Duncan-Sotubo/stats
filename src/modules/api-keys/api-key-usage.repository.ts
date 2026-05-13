// src/modules/api-keys/api-key-usage.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { apiKeyUsageLogs } from 'src/infrastructure/drizzle/schema/api-keys.schema';

export interface LogUsageParams {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  responseMs?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface DailyUsageRow {
  total: number;
  successful: number;
  errors: number;
  avgResponseMs: number;
  endpoint: string;
  endpointCount: number;
}

@Injectable()
export class ApiKeyUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async insert(params: LogUsageParams): Promise<void> {
    await this.db.insert(apiKeyUsageLogs).values({
      apiKeyId: params.apiKeyId,
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      responseMs: params.responseMs,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async getDailyUsage(apiKeyId: string, date: string) {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*)::int                                           AS total,
        COUNT(*) FILTER (WHERE status_code < 400)::int         AS successful,
        COUNT(*) FILTER (WHERE status_code >= 400)::int        AS errors,
        ROUND(AVG(response_ms))::int                           AS "avgResponseMs",
        endpoint,
        COUNT(*)::int                                          AS "endpointCount"
      FROM api_key_usage_logs
      WHERE api_key_id = ${apiKeyId}
        AND DATE(created_at) = ${date}::date
      GROUP BY endpoint
      ORDER BY "endpointCount" DESC
    `);
    return result.rows as DailyUsageRow[];
  }

  async getTotalUsage(apiKeyId: string) {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*)::int                                           AS total,
        COUNT(*) FILTER (WHERE status_code < 400)::int         AS successful,
        COUNT(*) FILTER (WHERE status_code >= 400)::int        AS errors,
        MIN(created_at)                                        AS "firstUsed",
        MAX(created_at)                                        AS "lastUsed"
      FROM api_key_usage_logs
      WHERE api_key_id = ${apiKeyId}
    `);
    return result.rows[0] as {
      total: number;
      successful: number;
      errors: number;
      firstUsed: Date | null;
      lastUsed: Date | null;
    };
  }
}
