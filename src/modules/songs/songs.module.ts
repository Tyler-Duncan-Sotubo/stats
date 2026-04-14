import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongScraperService } from './song-scraper.service';
import { SongsRepository } from './songs.repository';
import { SongsCron } from './songs.cron';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';
import { AlbumsModule } from '../albums/albums.module';
import { EntityResolutionService } from '../catalog/entity-resolution.service';

@Module({
  imports: [AlbumsModule],
  providers: [
    SongService,
    SongScraperService,
    SongsRepository,
    SpotifyMetadataService,
    SongsCron,
    EntityResolutionService,
  ],
  exports: [SongService, SongScraperService],
})
export class SongsModule {}
