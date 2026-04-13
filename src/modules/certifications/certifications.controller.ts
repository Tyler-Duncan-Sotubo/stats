import { Controller, Get, Param } from '@nestjs/common';
import { CertificationsService } from './certifications.service';

@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  // GET /certifications/sync/artist/:artistId
  @Get('sync/artist/:artistId')
  syncArtist(@Param('artistId') artistId: string) {
    return this.certificationsService.syncArtistCertifications(artistId);
  }

  @Get('sync/all')
  syncAll() {
    // Fire and forget — don't await, just kick it off
    // 300+ artists hitting RIAA will take several minutes
    this.certificationsService
      .syncAllArtists()
      .catch((err) =>
        console.error(`syncAllArtists failed: ${(err as Error).message}`),
      );

    return {
      message: 'RIAA sync started for all artists — check logs for progress',
    };
  }
}
