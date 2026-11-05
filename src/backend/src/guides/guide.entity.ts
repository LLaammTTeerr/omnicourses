import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { GuideGroup } from './guide-file.js';

@Entity({ name: 'guides' })
export class Guide {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  group!: GuideGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
