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
import { CertificationsService } from './certifications.service';
import { CertificationQueryDto } from './dto/certification-query.dto';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { UpdateCertificationDto } from './dto/update-certification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileParseInterceptor } from 'src/common/interceptors/file-parse.interceptor';
import { CertificationsBulkService } from './certifications-bulk.service';

@Controller('certifications')
@UseGuards(JwtAuthGuard)
export class CertificationsController {
  constructor(
    private readonly certificationsService: CertificationsService,
    private readonly certificationsBulkService: CertificationsBulkService,
  ) {}

  @Get()
  findAll(@Query() query: CertificationQueryDto) {
    return this.certificationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCertificationDto) {
    return this.certificationsService.create(dto);
  }

  @Post('bulk')
  @UseInterceptors(FileParseInterceptor({ field: 'file', maxRows: 500 }))
  async bulkCreate(@Body() rows: any[]) {
    return this.certificationsBulkService.bulkCreate(rows);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    return this.certificationsService.update(id, dto);
  }

  @Patch('bulk-resolve')
  @HttpCode(HttpStatus.OK)
  bulkResolve(
    @Body('ids') ids: string[],
    @Body('resolutionStatus') resolutionStatus: string,
  ) {
    return this.certificationsService.bulkResolve(ids, resolutionStatus);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificationsService.remove(id);
  }
}
