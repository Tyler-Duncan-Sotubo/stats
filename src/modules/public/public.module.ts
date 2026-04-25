import { Module } from '@nestjs/common';
import { CacheModule } from 'src/infrastructure/cache/cache.module';

import { TrendingController } from './trending/trending.controller';
import { TrendingService } from './trending/trending.service';
import { TrendingRepository } from './trending/trending.repository';

import { ArtistsController } from './artists/artists.controller';
import { ArtistsService } from './artists/artists.service';
import { ArtistsRepository } from './artists/artists.repository';

import { SongsController } from './songs/songs.controller';
import { SongsService } from './songs/songs.service';
import { SongsRepository } from './songs/songs.repository';

import { ChartsController } from './charts/charts.controller';
import { ChartsService } from './charts/charts.service';
import { ChartsRepository } from './charts/charts.repository';

import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { LeaderboardRepository } from './leaderboard/leaderboard.repository';

import { AskController } from './ask/ask.controller';
import { AskService } from './ask/ask.service';
import { AskRepository } from './ask/ask.repository';

import { MilestonesController } from './milestone/milestones.controller';
import { MilestonesService } from './milestone/milestones.service';
import { AskResolver } from './ask/ask-resolver';
import { AskFormatter } from './ask/ask-formatter';
import { AskDataService } from './ask/ask-data.service';
import { RankingsController } from './ranking/rankings.controller';

@Module({
  imports: [CacheModule],
  controllers: [
    TrendingController,
    ArtistsController,
    SongsController,
    ChartsController,
    LeaderboardController,
    AskController,
    MilestonesController,
    RankingsController,
  ],
  providers: [
    TrendingService,
    TrendingRepository,
    ArtistsService,
    ArtistsRepository,
    SongsService,
    SongsRepository,
    ChartsService,
    ChartsRepository,
    LeaderboardService,
    LeaderboardRepository,
    AskService,
    AskResolver,
    AskFormatter,
    AskDataService,
    AskRepository,
    MilestonesService,
  ],
})
export class PublicModule {}
