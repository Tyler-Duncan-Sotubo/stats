import { Module } from '@nestjs/common';
import { CertificationsController } from './certifications.controller';
import { CertificationsService } from './certifications.service';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { CertificationsBulkService } from './certifications-bulk.service';

@Module({
  controllers: [CertificationsController],
  providers: [
    CertificationsService,
    CertificationsRepository,
    ArtistsRepository,
    SongsRepository,
    CertificationsBulkService,
  ],
  exports: [CertificationsService, CertificationsRepository],
})
export class CertificationsModule {}
