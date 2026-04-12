import { Module } from '@nestjs/common';
import { SongService } from './song.service';
import { SongsRepository } from './songs.repository';
import { SpotifyMetadataService } from '../scraper/services/spotify-metadata.service';
import { AlbumsModule } from '../albums/albums.module';
import { SongsCron } from './songs.cron';

@Module({
  imports: [AlbumsModule],
  providers: [SongService, SongsRepository, SpotifyMetadataService, SongsCron],
  exports: [SongService],
})
export class SongsModule {}
