import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ApiKeysRepository } from './api-keys.repository';
import * as crypto from 'crypto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { RequestApiKeyDto } from './dto/request-api-key.dto';

export interface CreatedApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  name: string;
  email: string;
  tier: string;
  dailyLimit: number;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeysRepository: ApiKeysRepository) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateKey(): { raw: string; hash: string; prefix: string } {
    const random = crypto.randomBytes(32).toString('hex');
    const raw = `txc_live_${random}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, 12);
    return { raw, hash, prefix };
  }

  private dailyLimitForTier(tier: string): number {
    switch (tier) {
      case 'pro':
        return 10000;
      case 'enterprise':
        return 100000;
      default:
        return 1000;
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────

  // add to api-keys.service.ts
  async requestKey(dto: RequestApiKeyDto): Promise<CreatedApiKey> {
    const created = await this.create({
      name: dto.name,
      email: dto.email,
      website: dto.website,
      tier: 'free',
    });

    return created;
  }

  async create(dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    const existing = await this.apiKeysRepository.findActiveByEmail(dto.email);

    if (existing?.isActive) {
      throw new ConflictException(
        `An active API key already exists for ${dto.email}`,
      );
    }

    const tier = dto.tier ?? 'free';
    const { raw, hash, prefix } = this.generateKey();
    const dailyLimit = this.dailyLimitForTier(tier);

    const created = await this.apiKeysRepository.insert({
      name: dto.name,
      email: dto.email.toLowerCase(),
      website: dto.website,
      keyHash: hash,
      keyPrefix: prefix,
      tier,
      dailyLimit,
      isActive: true,
    });

    return {
      id: created.id,
      key: raw,
      keyPrefix: prefix,
      name: created.name,
      email: created.email,
      tier: created.tier,
      dailyLimit: created.dailyLimit,
      createdAt: created.createdAt,
    };
  }

  // ── Validate (used by guard) ───────────────────────────────────────────────

  async validate(rawKey: string) {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.apiKeysRepository.findByHash(hash);

    if (!key || !key.isActive) return null;

    this.apiKeysRepository.updateLastUsed(key.id);

    return key;
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async revoke(id: string, reason?: string): Promise<void> {
    const key = await this.apiKeysRepository.findById(id);
    if (!key) throw new NotFoundException(`API key ${id} not found`);

    await this.apiKeysRepository.revoke(id, reason);
  }

  // ── Find ──────────────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.apiKeysRepository.findByEmail(email);
  }

  async findAll() {
    return this.apiKeysRepository.findAll();
  }
}
