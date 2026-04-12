import { Module } from '@nestjs/common';
import { AlbumService } from './album.service';
import { AlbumsRepository } from './albums.repository';

@Module({
  providers: [AlbumService, AlbumsRepository],
  exports: [AlbumService],
})
export class AlbumsModule {}
