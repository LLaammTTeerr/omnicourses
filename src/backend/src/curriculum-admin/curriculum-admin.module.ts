import { Module } from '@nestjs/common';
import { AdminAccessModule } from '../admin-access/admin-access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { AccessAdminController } from './access-admin.controller.js';
import { AccessAdminService } from './access-admin.service.js';
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
  imports: [AdminAccessModule, CurriculumModule, AuthModule],
  controllers: [CurriculumAdminController, ProgramAdminController, CatalogAdminController, AccessAdminController, CsvImportController],
  providers: [CurriculumAdminService, ProgramAdminService, CatalogAdminService, AccessAdminService, CsvImportService, ImportBodyGate],
})
export class CurriculumAdminModule {}
