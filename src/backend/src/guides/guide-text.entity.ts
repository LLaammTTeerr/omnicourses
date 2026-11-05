import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { GuideContent, GuideLang } from './guide-file.js';
import { Guide } from './guide.entity.js';

// One guide in one language, as the seed loaded it from its content file.
@Entity({ name: 'guide_texts' })
export class GuideText {
  @PrimaryColumn({ name: 'guide_id', type: 'varchar', length: 64 })
  guideId!: string;

  @PrimaryColumn({ type: 'varchar', length: 2 })
  lang!: GuideLang;

  @ManyToOne(() => Guide, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guide_id' })
  guide!: Guide;

  @Column({ type: 'varchar', length: 20 })
  status!: 'published' | 'withdrawn';

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'change_note', type: 'text' })
  changeNote!: string;

  // TypeORM reads a date column as YYYY-MM-DD.
  @Column({ name: 'last_checked_on', type: 'date' })
  lastCheckedOn!: string;

  @Column({ name: 'last_checked_by', type: 'varchar', length: 100 })
  lastCheckedBy!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', array: true })
  keywords!: string[];

  @Column({ type: 'jsonb' })
  content!: GuideContent;

  @Column({ name: 'content_hash', type: 'char', length: 64 })
  contentHash!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
