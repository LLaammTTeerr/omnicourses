import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { AccessAdminController } from './access-admin.controller.js';
import { AccessAdminService } from './access-admin.service.js';
import { GlobalAdminGrant, ProgramAdminGrant } from './admin-grant.entities.js';
import { AdminWriteService } from './admin-write.service.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CsvImportController } from './csv-import.controller.js';
import { CsvImportService } from './csv-import.service.js';
import { CurriculumAdminController } from './curriculum-admin.controller.js';
import { CurriculumAdminService } from './curriculum-admin.service.js';
import { ImportBodyGate } from './import-body-limit.js';
import { ProgramAdminController } from './program-admin.controller.js';
import { ProgramAdminService } from './program-admin.service.js';

@Module({
  imports: [CurriculumModule, AuthModule, TypeOrmModule.forFeature([ProgramAdminGrant, GlobalAdminGrant])],
  controllers: [CurriculumAdminController, ProgramAdminController, CatalogAdminController, AccessAdminController, CsvImportController],
  providers: [AdminWriteService, CurriculumAdminService, ProgramAdminService, CatalogAdminService, AccessAdminService, CsvImportService, ImportBodyGate],
  exports: [AdminWriteService],
})
export class CurriculumAdminModule {}
