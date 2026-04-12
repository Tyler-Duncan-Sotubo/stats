import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';

@Controller('snapshots')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Post('artists/run')
  @HttpCode(HttpStatus.ACCEPTED)
  async snapshotAllArtists() {
    await this.snapshotService.snapshotAllArtists();

    return {
      success: true,
      message: 'Artist snapshot run completed',
    };
  }
}
