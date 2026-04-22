import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let _db: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!_db) throw new Error('DB not initialized yet');
  return _db;
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString: config.getOrThrow('DATABASE_URL'),
          max: 2,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        });

        _db = drizzle(pool, { schema });
        return _db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
