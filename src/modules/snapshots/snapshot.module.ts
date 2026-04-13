import { Module } from '@nestjs/common';
import { SnapshotController } from './snapshot.controller';
import { SnapshotService } from './snapshot.service';
import { SnapshotRepository } from './snapshot.repository';
import { ScraperModule } from '../scraper/scraper.module';
import { ArtistsModule } from '../artists/artists.module';
import { SnapshotCron } from './snapshot.cron';
import { SongsRepository } from '../songs/songs.repository';
import { AlbumsModule } from '../albums/albums.module';
import { SongScraperService } from '../songs/song-scraper.service';

@Module({
  imports: [ScraperModule, ArtistsModule, AlbumsModule],
  controllers: [SnapshotController],
  providers: [
    SnapshotService,
    SnapshotRepository,
    SnapshotCron,
    SongScraperService,
    SongsRepository,
  ],
})
export class SnapshotModule {}
