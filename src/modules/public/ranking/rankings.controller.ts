// rankings.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ArtistsService } from '../artists/artists.service';
import { parseRankingSlug } from 'src/utils/parse-ranking-slug';

@Controller('public/rankings')
export class RankingsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get(':slug')
  async getRanking(@Param('slug') slug: string) {
    const parsed = parseRankingSlug(slug);

    if (!parsed) throw new NotFoundException(`Invalid ranking: ${slug}`);
    if (parsed.limit > 100) throw new BadRequestException('Max 100');
    if (parsed.metric !== 'streams')
      throw new BadRequestException('Invalid metric');

    return this.artistsService.getArtistSongRanking(parsed);
  }
}
