import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranscriptRow } from './transcript-row.entity.js';
import { TranscriptController } from './transcript.controller.js';
import { TranscriptService } from './transcript.service.js';

// Exports TranscriptService for the degree audit (Triết) and the advisor (Dũng).
@Module({
  imports: [TypeOrmModule.forFeature([TranscriptRow])],
  controllers: [TranscriptController],
  providers: [TranscriptService],
  exports: [TranscriptService],
})
export class TranscriptModule {}
