import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClockModule } from '../common/clock.js';
import { GuideText } from './guide-text.entity.js';
import { Guide } from './guide.entity.js';
import { GuidesController } from './guides.controller.js';
import { GuidesService } from './guides.service.js';

// F11 guides (UC-10, ADR 0010): public reads of the guides the seed loaded.
@Module({
  imports: [TypeOrmModule.forFeature([Guide, GuideText]), ClockModule],
  controllers: [GuidesController],
  providers: [GuidesService],
})
export class GuidesModule {}
