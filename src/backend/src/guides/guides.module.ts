import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuideText } from './guide-text.entity.js';
import { Guide } from './guide.entity.js';
import { GuidesController } from './guides.controller.js';
import { GuidesService } from './guides.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Guide, GuideText])],
  controllers: [GuidesController],
  providers: [GuidesService],
})
export class GuidesModule {}
