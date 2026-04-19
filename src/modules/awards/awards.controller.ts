import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AwardsService } from './awards.service';
import { AwardQueryDto } from './dto/award-query.dto';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileParseInterceptor } from 'src/common/interceptors/file-parse.interceptor';
import { AwardsBulkService } from './awards-bulk.service';
@Controller('awards')
@UseGuards(JwtAuthGuard)
export class AwardsController {
  constructor(
    private readonly awardsService: AwardsService,
    private readonly awardsBulkService: AwardsBulkService,
  ) {}

  @Get()
  findAll(@Query() query: AwardQueryDto) {
    return this.awardsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.awardsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAwardDto) {
    return this.awardsService.create(dto);
  }

  // Add endpoint:
  @Post('bulk')
  @UseInterceptors(FileParseInterceptor({ field: 'file', maxRows: 500 }))
  bulkCreate(@Body() rows: any[]) {
    return this.awardsBulkService.bulkCreate(rows);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAwardDto) {
    return this.awardsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.awardsService.remove(id);
  }
}
