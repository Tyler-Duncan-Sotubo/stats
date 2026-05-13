// src/modules/api-keys/api-keys.module.ts
import { Module } from '@nestjs/common';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyUsageRepository } from './api-key-usage.repository';
import { ApiKeyUsageService } from './api-key-usage.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysPublicController } from './api-keys-public.controller';

@Module({
  controllers: [ApiKeysController, ApiKeysPublicController],
  providers: [
    ApiKeysRepository,
    ApiKeysService,
    ApiKeyUsageRepository,
    ApiKeyUsageService,
    ApiKeyGuard,
  ],
  exports: [ApiKeysService, ApiKeyUsageService, ApiKeyGuard],
})
export class ApiKeysModule {}
