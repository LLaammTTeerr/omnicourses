import { Check, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { GuideGroup } from './guide-file.js';

@Entity({ name: 'guides' })
@Check('ck_guides_id', `"id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
@Check('ck_guides_group', `"group" IN ('accounts-and-portals', 'registration', 'timetable-and-exams', 'tuition-and-fees', 'records-and-certificates', 'scholarships', 'internship-and-thesis', 'graduation')`)
export class Guide {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  group!: GuideGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
