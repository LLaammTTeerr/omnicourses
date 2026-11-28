import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalAdminGrant, ProgramAdminGrant } from './admin-grant.entities.js';
import { AdminWriteService } from './admin-write.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProgramAdminGrant, GlobalAdminGrant])],
  providers: [AdminWriteService],
  exports: [AdminWriteService],
})
export class AdminAccessModule {}
