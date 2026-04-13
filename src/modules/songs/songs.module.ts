import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongScraperService } from './song-scraper.service';
import { SongsRepository } from './songs.repository';
import { SongsCron } from './songs.cron';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';
import { AlbumsModule } from '../albums/albums.module';

@Module({
  imports: [AlbumsModule],
  providers: [
    SongService,
    SongScraperService,
    SongsRepository,
    SpotifyMetadataService,
    SongsCron,
  ],
  exports: [SongService, SongScraperService],
})
export class SongsModule {}
