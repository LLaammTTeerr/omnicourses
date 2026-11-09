import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptRow } from './transcript-row.entity.js';
import { TranscriptController } from './transcript.controller.js';
import { TranscriptService } from './transcript.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TranscriptRow])],
  controllers: [TranscriptController],
  providers: [TranscriptService],
  exports: [TranscriptService],
})
export class TranscriptModule {}
