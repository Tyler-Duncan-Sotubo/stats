import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { RecordsRepository } from './records.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { RecordsBulkService } from './records-bulk.service';

@Module({
  controllers: [RecordsController],
  providers: [
    RecordsService,
    RecordsRepository,
    ArtistsRepository,
    SongsRepository,
    RecordsBulkService,
  ],
  exports: [RecordsService, RecordsRepository],
})
export class RecordsModule {}
