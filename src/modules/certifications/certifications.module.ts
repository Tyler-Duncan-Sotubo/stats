// src/modules/certifications/certifications.module.ts

import { Module } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CertificationsRepository } from './certifications.repository';
import { CertificationsController } from './certifications.controller';
import { RiaaCertificationService } from '../scraper/services/riaa-certification.service';
import { ArtistsModule } from '../artists/artists.module';
import { CertificationsScheduler } from './certifications.scheduler';
import { SongsRepository } from '../songs/songs.repository';
import { EntityResolutionService } from '../catalog/entity-resolution.service';

@Module({
  imports: [ArtistsModule],
  controllers: [CertificationsController],
  providers: [
    CertificationsService,
    CertificationsRepository,
    RiaaCertificationService,
    CertificationsScheduler,
    SongsRepository,
    EntityResolutionService,
  ],
  exports: [CertificationsService],
})
export class CertificationsModule {}
