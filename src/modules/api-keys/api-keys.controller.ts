// src/modules/api-keys/api-keys.controller.ts
import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyUsageService } from './api-key-usage.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly apiKeyUsageService: ApiKeyUsageService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(dto);
  }

  // ── List all ──────────────────────────────────────────────────────────────

  @Get()
  async findAll() {
    return this.apiKeysService.findAll();
  }

  // ── Find by email ─────────────────────────────────────────────────────────

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    return this.apiKeysService.findByEmail(email);
  }

  // ── Usage ─────────────────────────────────────────────────────────────────

  @Get(':id/usage')
  async getUsage(@Param('id') id: string, @Query('date') date?: string) {
    const target = date ?? new Date().toISOString().slice(0, 10);

    const [daily, total] = await Promise.all([
      this.apiKeyUsageService.getDailyUsage(id, target),
      this.apiKeyUsageService.getTotalUsage(id),
    ]);

    return { daily, total };
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @Query('reason') reason?: string) {
    await this.apiKeysService.revoke(id, reason);
  }
}
