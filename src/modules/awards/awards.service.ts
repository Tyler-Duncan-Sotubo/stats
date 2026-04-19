import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AwardsRepository } from './awards.repository';
import { ArtistsRepository } from '../artists/artists.repository';
import { SongsRepository } from '../songs/songs.repository';
import { AwardQueryDto } from './dto/award-query.dto';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';

@Injectable()
export class AwardsService {
  constructor(
    private readonly awardsRepository: AwardsRepository,
    private readonly artistsRepository: ArtistsRepository,
    private readonly songsRepository: SongsRepository,
  ) {}

  async findAll(query: AwardQueryDto) {
    const { rows, total } = await this.awardsRepository.findAll({
      artistId: query.artistId,
      awardBody: query.awardBody,
      category: query.category,
      result: query.result,
      territory: query.territory,
      year: query.year,
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
    const award = await this.awardsRepository.findById(id);
    if (!award) throw new NotFoundException(`Award ${id} not found`);
    return award;
  }

  async create(dto: CreateAwardDto) {
    if (!dto.artistId && !dto.songId && !dto.albumId) {
      throw new BadRequestException(
        'At least one of artistId, songId or albumId is required',
      );
    }

    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);

      // Check unique constraint
      const existing = await this.awardsRepository.findByUniqueKey(
        dto.artistId,
        dto.awardBody,
        dto.awardName,
        dto.year,
      );
      if (existing) {
        throw new ConflictException(
          `Award already exists for this artist/body/name/year combination`,
        );
      }
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    return this.awardsRepository.create(dto);
  }

  async update(id: string, dto: UpdateAwardDto) {
    const award = await this.awardsRepository.findById(id);
    if (!award) throw new NotFoundException(`Award ${id} not found`);

    if (dto.artistId) {
      const artist = await this.artistsRepository.findById(dto.artistId);
      if (!artist)
        throw new NotFoundException(`Artist ${dto.artistId} not found`);
    }

    if (dto.songId) {
      const song = await this.songsRepository.findById(dto.songId);
      if (!song) throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    return this.awardsRepository.update(id, dto);
  }

  async remove(id: string) {
    const award = await this.awardsRepository.findById(id);
    if (!award) throw new NotFoundException(`Award ${id} not found`);
    return this.awardsRepository.delete(id);
  }
}
