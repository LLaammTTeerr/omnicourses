import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One row per structured() or chat() call. Never the prompt or the reply
// (AGENTS.md hard rule 3): only who, which feature, which model, how much.
@Entity({ name: 'ai_usage' })
@Index('ix_ai_usage_user_id_created_at', ['userId', 'createdAt'])
export class AiUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  feature!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'integer', default: 0 })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'integer', default: 0 })
  outputTokens!: number;

  @Column({ name: 'latency_ms', type: 'integer', default: 0 })
  latencyMs!: number;

  @Column({ type: 'boolean', default: false })
  succeeded!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
