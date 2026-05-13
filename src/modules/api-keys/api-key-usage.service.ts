import { Injectable } from '@nestjs/common';
import {
  ApiKeyUsageRepository,
  LogUsageParams,
} from './api-key-usage.repository';

@Injectable()
export class ApiKeyUsageService {
  constructor(private readonly apiKeyUsageRepository: ApiKeyUsageRepository) {}

  async log(params: LogUsageParams): Promise<void> {
    try {
      await this.apiKeyUsageRepository.insert(params);
    } catch (err) {
      console.error('Usage log failed:', err); // add this temporarily
    }
  }

  async getDailyUsage(apiKeyId: string, date: string) {
    return this.apiKeyUsageRepository.getDailyUsage(apiKeyId, date);
  }

  async getTotalUsage(apiKeyId: string) {
    return this.apiKeyUsageRepository.getTotalUsage(apiKeyId);
  }
}
