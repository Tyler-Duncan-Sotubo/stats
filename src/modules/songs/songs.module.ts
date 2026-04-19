import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';
import { ArtistsRepository } from '../artists/artists.repository';

@Module({
  controllers: [SongsController],
  providers: [SongsService, SongsRepository, ArtistsRepository],
  exports: [SongsService, SongsRepository],
})
export class SongsModule {}
