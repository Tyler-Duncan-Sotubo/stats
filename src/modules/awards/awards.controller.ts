import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Logger,
} from '@nestjs/common';
import { AwardsService } from './awards.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { QueryAwardDto } from './dto/query-award.dto';

@Controller('awards')
export class AwardsController {
  private readonly logger = new Logger(AwardsController.name);

  constructor(private readonly awardsService: AwardsService) {}

  // ── Create ────────────────────────────────────────────────────────────

  @Post()
  create(@Body() body: CreateAwardDto) {
    return this.awardsService.create(body);
  }

  // ── Read ──────────────────────────────────────────────────────────────
  @Get()
  getMany(@Query() query: QueryAwardDto) {
    return this.awardsService.getMany(query);
  }

  @Get('artist/:artistId')
  getByArtist(@Param('artistId') artistId: string) {
    return this.awardsService.getByArtist(artistId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.awardsService.getById(id);
  }

  // ── Update ────────────────────────────────────────────────────────────

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateAwardDto) {
    return this.awardsService.update(id, body);
  }

  // ── Delete ────────────────────────────────────────────────────────────

  @Delete('bulk')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.awardsService.bulkDelete(body.ids);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.awardsService.delete(id);
  }
}
