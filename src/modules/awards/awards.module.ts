import { Module } from '@nestjs/common';
import { AwardsController } from './awards.controller';
import { AwardsService } from './awards.service';
import { AwardsRepository } from './awards.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { AwardsBulkService } from './awards-bulk.service';

@Module({
  controllers: [AwardsController],
  providers: [
    AwardsService,
    AwardsRepository,
    ArtistsRepository,
    SongsRepository,
    AwardsBulkService,
  ],
  exports: [AwardsService, AwardsRepository],
})
export class AwardsModule {}
