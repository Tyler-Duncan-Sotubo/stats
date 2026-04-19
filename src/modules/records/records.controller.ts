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
import { RecordsService } from './records.service';
import { RecordQueryDto } from './dto/record-query.dto';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { BreakRecordDto } from './dto/break-record.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileParseInterceptor } from 'src/common/interceptors/file-parse.interceptor';
import { RecordsBulkService } from './records-bulk.service';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly recordsBulkService: RecordsBulkService,
  ) {}

  @Get()
  findAll(@Query() query: RecordQueryDto) {
    return this.recordsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recordsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecordDto) {
    return this.recordsService.create(dto);
  }

  // Add endpoint
  @Post('bulk')
  @UseInterceptors(FileParseInterceptor({ field: 'file', maxRows: 500 }))
  async bulkCreate(@Body() rows: any[]) {
    return this.recordsBulkService.bulkCreate(rows);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecordDto) {
    return this.recordsService.update(id, dto);
  }

  // POST /records/:id/break — marks as broken, sets brokenOn date
  @Post(':id/break')
  @HttpCode(HttpStatus.OK)
  breakRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BreakRecordDto,
  ) {
    return this.recordsService.breakRecord(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recordsService.remove(id);
  }
}
