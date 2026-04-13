import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AwardsRepository } from './awards.repository';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { QueryAwardDto } from './dto/query-award.dto';
import { CacheService } from 'src/infrastructure/cache/cache.service';

@Injectable()
export class AwardsService {
  private readonly logger = new Logger(AwardsService.name);

  constructor(
    private readonly awardsRepository: AwardsRepository,
    private readonly cache: CacheService,
  ) {}

  // ── Single create ─────────────────────────────────────────────────────

  async create(input: CreateAwardDto) {
    const award = await this.awardsRepository.create(input);
    await this.invalidateForArtist(input.artistId);
    this.logger.log(
      `Award created: ${input.awardBody} "${input.awardName}" ${input.year} for artist ${input.artistId}`,
    );
    return award;
  }

  // ── Bulk create — used for CSV uploads ───────────────────────────────

  // TODO add this later from my other setup

  // ── Update ────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateAwardDto) {
    const existing = await this.awardsRepository.findById(id);
    if (!existing) throw new NotFoundException(`Award ${id} not found`);

    const updated = await this.awardsRepository.update(id, input);
    await this.invalidateForArtist(existing.artistId ?? '');

    this.logger.log(`Award ${id} updated`);
    return updated;
  }

  // ── Delete ────────────────────────────────────────────────────────────

  async delete(id: string) {
    const existing = await this.awardsRepository.findById(id);
    if (!existing) throw new NotFoundException(`Award ${id} not found`);

    const deleted = await this.awardsRepository.delete(id);
    await this.invalidateForArtist(existing.artistId ?? '');

    this.logger.log(`Award ${id} deleted`);
    return deleted;
  }

  async bulkDelete(ids: string[]) {
    const deleted = await this.awardsRepository.deleteByIds(ids);
    this.logger.log(`Bulk deleted ${deleted.length} awards`);
    return deleted;
  }

  // ── Read ──────────────────────────────────────────────────────────────

  async getById(id: string) {
    const award = await this.awardsRepository.findById(id);
    if (!award) throw new NotFoundException(`Award ${id} not found`);
    return award;
  }

  async getMany(query: QueryAwardDto) {
    const cacheKey = `awards:query:${JSON.stringify(query)}`;
    return this.cache.cached(cacheKey, CacheService.TTL.EXTENDED, () =>
      this.awardsRepository.findMany(query),
    );
  }

  async getByArtist(artistId: string) {
    return this.cache.cached(
      `awards:artist:${artistId}`,
      CacheService.TTL.EXTENDED,
      () => this.awardsRepository.findByArtist(artistId),
    );
  }

  async invalidateForArtist(artistId: string) {
    await this.cache.invalidatePatterns([
      `awards:artist:${artistId}*`,
      `awards:query:*`,
    ]);
  }
}
