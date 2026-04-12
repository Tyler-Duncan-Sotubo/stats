import { Controller, Get, Param } from '@nestjs/common';
import { CertificationsService } from './certifications.service';

@Controller('api/certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  // GET /api/certifications/sync/artist/:artistId
  @Get('sync/artist/:artistId')
  syncArtist(@Param('artistId') artistId: string) {
    return this.certificationsService.syncArtistCertifications(artistId);
  }
}
