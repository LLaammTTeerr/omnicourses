import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuideText } from './guide-text.entity.js';
import { GuidesController } from './guides.controller.js';
import { GUIDES_CLOCK, GuidesService } from './guides.service.js';

// F11 guides (UC-10, ADR 0010): public reads of the guides the seed loaded.
@Module({
  imports: [TypeOrmModule.forFeature([GuideText])],
  controllers: [GuidesController],
  providers: [GuidesService, { provide: GUIDES_CLOCK, useValue: () => new Date() }],
})
export class GuidesModule {}
