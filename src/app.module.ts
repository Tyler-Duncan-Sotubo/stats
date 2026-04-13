import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule } from './infrastructure/drizzle/drizzle.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SnapshotModule } from './modules/snapshots/snapshot.module';
import { SongsModule } from './modules/songs/songs.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { AppRedisModule } from './infrastructure/redis/redis.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AwardsModule } from './modules/awards/awards.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AppRedisModule,
    CacheModule,
    // app.module.ts
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(8000),
        SPOTIFY_CLIENT_ID: Joi.string().required(),
        SPOTIFY_CLIENT_SECRET: Joi.string().required(),
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
    ScraperModule,
    ArtistsModule,
    DiscoveryModule,
    SnapshotModule,
    SongsModule,
    AlbumsModule,
    CertificationsModule,
    AwardsModule,
  ],
})
export class AppModule {}
