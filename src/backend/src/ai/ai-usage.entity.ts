import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

// One row per structured() or chat() call. Never the prompt or the reply
// (AGENTS.md hard rule 3): only who, which feature, which model, how much.
@Entity({ name: 'ai_usage' })
@Index('ix_ai_usage_user_id_created_at', ['userId', 'createdAt'])
export class AiUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  feature!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ name: 'input_tokens', type: 'integer' })
  inputTokens!: number;

  @Column({ name: 'output_tokens', type: 'integer' })
  outputTokens!: number;

  @Column({ name: 'latency_ms', type: 'integer' })
  latencyMs!: number;

  @Column({ type: 'boolean' })
  succeeded!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
