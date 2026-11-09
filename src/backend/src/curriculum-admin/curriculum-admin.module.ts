import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { AccessAdminController } from './access-admin.controller.js';
import { AccessAdminService } from './access-admin.service.js';
import { GlobalAdminGrant, ProgramAdminGrant } from './admin-grant.entities.js';
import { AdminWriteService } from './admin-write.service.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CurriculumAdminController } from './curriculum-admin.controller.js';
import { CurriculumAdminService } from './curriculum-admin.service.js';

// F12 curriculum administration (ADR 0011): grants, program writes, catalog writes. It writes
// the tables the curriculum module maps and reads; it adds no authentication of its own.
@Module({
  imports: [CurriculumModule, TypeOrmModule.forFeature([ProgramAdminGrant, GlobalAdminGrant])],
  controllers: [CurriculumAdminController, CatalogAdminController, AccessAdminController],
  providers: [AdminWriteService, CurriculumAdminService, CatalogAdminService, AccessAdminService],
})
export class CurriculumAdminModule {}
