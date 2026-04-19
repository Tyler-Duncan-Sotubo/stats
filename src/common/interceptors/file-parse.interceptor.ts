// src/common/interceptors/file-parse.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Type,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { join, extname } from 'path';
import { mkdir, unlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { v4 as uuid } from 'uuid';
import { parseFile } from '../../utils/file-parser';

export interface FileParseOptions {
  field?: string; // form‐field name, defaults to 'file'
  maxRows?: number; // how many rows before throwing
  tempDir?: string; // base temp folder, defaults to src/temp
  allowedExts?: string[]; // extensions to accept, defaults ['csv','xls','xlsx']
}

export function FileParseInterceptor(
  opts: FileParseOptions,
): Type<NestInterceptor> {
  const {
    field = 'file',
    maxRows = 600,
    tempDir = join(process.cwd(), 'src', 'temp'),
    allowedExts = ['csv', 'xls', 'xlsx'],
  } = opts;

  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<any>> {
      const req = context
        .switchToHttp()
        .getRequest<FastifyRequest & { user?: any }>();

      if (!req.isMultipart?.()) {
        throw new BadRequestException('Request must be multipart/form-data');
      }

      const data = await req.file();
      if (!data || data.fieldname !== field) {
        throw new BadRequestException(`Field "${field}" is required`);
      }

      const { file: stream, filename, mimetype } = data;
      const ext = extname(filename).slice(1).toLowerCase();
      if (
        !allowedExts.includes(ext) ||
        !mimetype.includes(ext === 'csv' ? 'csv' : 'sheet')
      ) {
        throw new BadRequestException(
          `Only ${allowedExts.join('/').toUpperCase()} files are supported`,
        );
      }

      // build date‐folder
      const dateSeg = new Date().toISOString().slice(0, 10);
      const destDir = join(tempDir, dateSeg);
      await mkdir(destDir, { recursive: true });

      // write to disk
      const saveName = `${uuid()}.${ext}`;
      const path = join(destDir, saveName);
      const ws = createWriteStream(path);
      await pipeline(stream, ws);

      // parse
      let rows: any[];
      try {
        rows = await parseFile(path, filename, maxRows);
      } finally {
        // cleanup
        unlink(path).catch(() => {});
      }

      // slap into body and continue
      (req as any).body = rows;
      return next.handle();
    }
  }

  return MixinInterceptor as Type<NestInterceptor>;
}
