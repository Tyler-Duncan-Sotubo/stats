import { Module } from '@nestjs/common';
import { AwardsService } from './awards.service';
import { AwardsRepository } from './awards.repository';
import { AwardsController } from './awards.controller';

@Module({
  providers: [AwardsService, AwardsRepository],
  controllers: [AwardsController],
  exports: [AwardsService],
})
export class AwardsModule {}
