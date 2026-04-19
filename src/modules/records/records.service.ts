import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RecordsRepository } from './records.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { RecordQueryDto } from './dto/record-query.dto';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { BreakRecordDto } from './dto/break-record.dto';

@Injectable()
export class RecordsService {
  constructor(
    private readonly recordsRepository: RecordsRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly songsRepository: SongsRepository,
  ) {}

  async findAll(query: RecordQueryDto) {
    const { rows, total } = await this.recordsRepository.findAll({
      artistId: query.artistId,
      songId: query.songId,
      recordType: query.recordType,
      scope: query.scope,
      isActive: query.isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      data: rows,
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        totalPages: Math.ceil(total / (query.limit ?? 20)),
      },
    };
  }

  async findOne(id: string) {
    const record = await this.recordsRepository.findById(id);
    if (!record) throw new NotFoundException(`Record ${id} not found`);
    return record;
  }

  async create(dto: CreateRecordDto) {
    if (!dto.artistId && !dto.songId && !dto.albumId) {
      throw new BadRequestException(
        'At least one of artistId, songId or albumId is required',
      );
    }

    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    // Warn if an active record of this type+scope already exists
    const existingActive =
      await this.recordsRepository.findActiveByTypeAndScope(
        dto.recordType,
        dto.scope,
      );
    if (existingActive && dto.isActive !== false) {
      throw new ConflictException(
        `An active record of type "${dto.recordType}" in scope "${dto.scope}" already exists (id: ${existingActive.id}). Break it first or set isActive: false on the new entry.`,
      );
    }

    return this.recordsRepository.create(dto);
  }

  async update(id: string, dto: UpdateRecordDto) {
    const record = await this.recordsRepository.findById(id);
    if (!record) throw new NotFoundException(`Record ${id} not found`);

    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    return this.recordsRepository.update(id, dto);
  }

  // Marks a record as broken — call this before creating
  // the new record that supersedes it
  async breakRecord(id: string, dto: BreakRecordDto) {
    const record = await this.recordsRepository.findById(id);
    if (!record) throw new NotFoundException(`Record ${id} not found`);

    if (!record.isActive) {
      throw new BadRequestException(`Record ${id} is already broken`);
    }

    return this.recordsRepository.breakRecord(id, dto.brokenOn, dto.notes);
  }

  async remove(id: string) {
    const record = await this.recordsRepository.findById(id);
    if (!record) throw new NotFoundException(`Record ${id} not found`);
    return this.recordsRepository.delete(id);
  }
}
