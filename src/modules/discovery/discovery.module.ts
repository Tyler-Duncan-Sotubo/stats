import { Module } from '@nestjs/common';
import { DiscoveryCron } from './discovery.cron';
import { DiscoveryController } from './discovery.controller';
import { ArtistsModule } from '../artists/artists.module';
import { KworbArtistDiscoveryService } from '../scraper/services/kworb-artist-discovery.service';

@Module({
  imports: [ArtistsModule],
  controllers: [DiscoveryController],
  providers: [KworbArtistDiscoveryService, DiscoveryCron],
})
export class DiscoveryModule {}
