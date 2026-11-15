import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvisorConsent } from './advisor-consent.entity.js';
import type { AdvisorConsentDto } from './advisor.dto.js';

// Consent to send the pseudonymous record to the AI provider (ADR 0003, UC-08 step 2, A1, A12).
@Injectable()
export class AdvisorConsentService {
  constructor(@InjectRepository(AdvisorConsent) private readonly consents: Repository<AdvisorConsent>) {}

  async statusFor(userId: string): Promise<AdvisorConsentDto> {
    const row = await this.consents.findOneBy({ userId });
    return { consented: row !== null, consentedAt: row?.consentedAt.toISOString() ?? null };
  }

  async hasConsented(userId: string): Promise<boolean> {
    return this.consents.existsBy({ userId });
  }

  /** Records consent; a student who already consented keeps the first time. */
  async grant(userId: string): Promise<AdvisorConsentDto> {
    await this.consents.createQueryBuilder().insert().values({ userId }).orIgnore().execute();
    return this.statusFor(userId);
  }

  /** Withdraws consent at once: the next question is answered in general mode (UC-08 A12). */
  async withdraw(userId: string): Promise<AdvisorConsentDto> {
    await this.consents.delete({ userId });
    return this.statusFor(userId);
  }
}
