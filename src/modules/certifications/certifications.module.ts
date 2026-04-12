// src/modules/certifications/certifications.module.ts

import { Module } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CertificationsRepository } from './certifications.repository';
import { CertificationsController } from './certifications.controller';
import { RiaaCertificationService } from '../scraper/services/riaa-certification.service';
import { BpiCertificationService } from '../scraper/services/bpi-certification.service';
import { ArtistsModule } from '../artists/artists.module';

@Module({
  imports: [ArtistsModule],
  controllers: [CertificationsController],
  providers: [
    CertificationsService,
    CertificationsRepository,
    RiaaCertificationService,
    BpiCertificationService,
  ],
  exports: [CertificationsService],
})
export class CertificationsModule {}
