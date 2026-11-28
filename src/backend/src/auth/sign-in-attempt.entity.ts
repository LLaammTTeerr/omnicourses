import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sign_in_attempts' })
@Index('idx_sign_in_attempts_key_time', ['attemptKey', 'attemptedAt'])
@Index('idx_sign_in_attempts_time', ['attemptedAt'])
export class SignInAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_key', type: 'char', length: 64 })
  attemptKey!: string;

  @Column({ name: 'attempted_at', type: 'timestamptz' })
  attemptedAt!: Date;
}
