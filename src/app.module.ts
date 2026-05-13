import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule } from './infrastructure/drizzle/drizzle.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { AppRedisModule } from './infrastructure/redis/redis.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { SongsModule } from './modules/songs/songs.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { AwardsModule } from './modules/awards/awards.module';
import { RecordsModule } from './modules/records/records.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { AuthModule } from './modules/auth/auth.module';
import { PublicModule } from './modules/public/public.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { V1Module } from './modules/v1/v1.module';

@Module({
  imports: [
    DatabaseModule,
    AppRedisModule,
    CacheModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        CLIENT_URL: Joi.string().required(),
        COOKIE_SECRET: Joi.string().required(),
        PORT: Joi.number().default(8000),
        REDIS_URL: Joi.string().required(),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    AuthModule,
    ArtistsModule,
    SongsModule,
    CertificationsModule,
    AwardsModule,
    RecordsModule,
    AlbumsModule,
    PublicModule,
    ApiKeysModule,
    V1Module,
  ],
})
export class AppModule {}
