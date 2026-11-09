import { CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

// A student's consent to send their pseudonymous record to the AI provider (ADR 0003, UC-08 step 2).
// One row while consent stands; withdrawing deletes it (UC-08 A12). Keyed by user_id with
// ON DELETE CASCADE, so account export and deletion cover it (ADR 0004).
@Entity({ name: 'advisor_consents' })
export class AdvisorConsent {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'consented_at', type: 'timestamptz' })
  consentedAt!: Date;
}
