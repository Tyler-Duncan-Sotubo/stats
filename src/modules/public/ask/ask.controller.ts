import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AskService } from './ask.service';
import { AskRepository } from './ask.repository';
import { AskDto } from './dto/ask.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('public/ask')
export class AskController {
  constructor(
    private readonly askService: AskService,
    private readonly askRepository: AskRepository,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  ask(@Body() body: AskDto) {
    return this.askService.ask(body.question);
  }

  @Get('popular')
  getPopular(@Query('limit') limit?: string) {
    return this.askRepository.getPopular(limit ? Number(limit) : 10);
  }

  @Get('recent')
  getRecent(@Query('limit') limit?: string) {
    return this.askRepository.getRecent(limit ? Number(limit) : 10);
  }

  @Get('suggest')
  suggest(@Query('q') q: string, @Query('limit') limit?: string) {
    if (!q) return [];
    return this.askRepository.suggest(q, limit ? Number(limit) : 5);
  }

  @Get('stats')
  getStats() {
    return this.askRepository.getStats();
  }

  @Get('indexable')
  async getIndexable() {
    return this.askService.getIndexable();
  }
}
