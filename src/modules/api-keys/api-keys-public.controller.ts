// src/modules/api-keys/api-keys-public.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { RequestApiKeyDto } from './dto/request-api-key.dto';

@Controller('public/api-keys')
export class ApiKeysPublicController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  async request(@Body() dto: RequestApiKeyDto) {
    await this.apiKeysService.requestKey(dto);
    return {
      message: 'Your API key has been sent to your email address.',
    };
  }
}
