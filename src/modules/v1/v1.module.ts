// src/modules/v1/v1.module.ts
import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { V1ArtistsController } from './controllers/v1-artists.controller';
import { V1SongsController } from './controllers/v1-songs.controller';
import { V1MilestonesController } from './controllers/v1-milestones.controller';
import { V1LeaderboardController } from './controllers/v1-leaderboard.controller';
import { V1TrendingController } from './controllers/v1-trending.controller';
import { V1AlbumsController } from './controllers/v1-albums.controller';
import { V1ChartsController } from './controllers/v1-charts.controller';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [ApiKeysModule, PublicModule],
  controllers: [
    V1ArtistsController,
    V1SongsController,
    V1MilestonesController,
    V1LeaderboardController,
    V1TrendingController,
    V1AlbumsController,
    V1ChartsController,
  ],
})
export class V1Module {}
