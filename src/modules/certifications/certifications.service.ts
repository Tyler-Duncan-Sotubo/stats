import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CertificationsRepository } from './certifications.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { CertificationQueryDto } from './dto/certification-query.dto';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@Injectable()
export class CertificationsService {
  constructor(
    private readonly certificationsRepository: CertificationsRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly songsRepository: SongsRepository,
  ) {}

  async findAll(query: CertificationQueryDto) {
    const { rows, total } = await this.certificationsRepository.findAll({
      artistId: query.artistId,
      songId: query.songId,
      territory: query.territory,
      body: query.body,
      level: query.level,
      resolutionStatus: query.resolutionStatus,
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
    const cert = await this.certificationsRepository.findById(id);
    if (!cert) throw new NotFoundException(`Certification ${id} not found`);
    return cert;
  }

  async create(dto: CreateCertificationDto) {
    if (!dto.artistId && !dto.songId) {
      throw new BadRequestException(
        'At least one of artistId or songId is required',
      );
    }

    // Validate referenced entities exist
    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    // Check unique constraint
    if (dto.artistId) {
      const existing = await this.certificationsRepository.findByUniqueKey(
        dto.artistId,
        dto.territory,
        dto.body,
        dto.title,
      );
      if (existing) {
        throw new ConflictException(
          `Certification already exists for this artist/territory/body/title combination`,
        );
      }
    }

    return this.certificationsRepository.create({
      ...dto,
      resolutionStatus: dto.resolutionStatus ?? 'matched',
    });
  }

  async update(id: string, dto: UpdateCertificationDto) {
    const cert = await this.certificationsRepository.findById(id);
    if (!cert) throw new NotFoundException(`Certification ${id} not found`);

    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    return this.certificationsRepository.update(id, dto);
  }

  async bulkResolve(ids: string[], resolutionStatus: string) {
    if (!['matched', 'artist_only', 'unresolved'].includes(resolutionStatus)) {
      throw new BadRequestException(
        `Invalid resolutionStatus: ${resolutionStatus}`,
      );
    }
    return this.certificationsRepository.bulkResolve(ids, resolutionStatus);
  }

  async remove(id: string) {
    const cert = await this.certificationsRepository.findById(id);
    if (!cert) throw new NotFoundException(`Certification ${id} not found`);
    return this.certificationsRepository.delete(id);
  }
}
