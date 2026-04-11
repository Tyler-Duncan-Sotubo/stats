import { Module } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { ArtistsRepository } from './artists.repository';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [ScraperModule],
  providers: [ArtistsService, ArtistsRepository],
  exports: [ArtistsService],
})
export class ArtistsModule {}
