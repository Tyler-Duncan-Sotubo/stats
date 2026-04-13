import { Module } from '@nestjs/common';
import { AlbumService } from './album.service';
import { AlbumScraperService } from './album-scraper.service';
import { AlbumsRepository } from './albums.repository';

@Module({
  providers: [AlbumService, AlbumScraperService, AlbumsRepository],
  exports: [AlbumService, AlbumScraperService],
})
export class AlbumsModule {}
