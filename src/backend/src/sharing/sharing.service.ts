import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { isRefusal, SQLSTATE } from '../common/failure-kind.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { planNotFound } from '../plans/plan-id.js';
import { PlansService } from '../plans/plans.service.js';
import { courseCodesOf } from '../rules/plan-issues.js';
import { RulesService } from '../rules/rules.service.js';
import { PlanShare } from './plan-share.entity.js';
import { sharedPlan } from './shared-plan.js';
import { NOT_SHARED_MESSAGE, PlanShareDto, SharedPlanDto } from './sharing.dto.js';

const TOKEN_BYTES = 32;
const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const newShareToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

export const isShareToken = (value: unknown): value is string => typeof value === 'string' && SHARE_TOKEN.test(value);

const notShared = () => new NotFoundException(NOT_SHARED_MESSAGE);

interface ShareRow {
  share_token: string;
  show_name: boolean;
  show_transcript_checks: boolean;
  created_at: Date;
}
const toShareDto = (row: ShareRow): PlanShareDto => ({ token: row.share_token, showName: row.show_name, showTranscriptChecks: row.show_transcript_checks, createdAt: row.created_at });
const SHARE_COLUMNS = '"share_token", "show_name", "show_transcript_checks", "created_at"';

interface ShareChoices {
  showName?: boolean;
  showTranscriptChecks?: boolean;
}

@Injectable()
export class SharingService {
  constructor(
    private readonly db: DataSource,
    private readonly plans: PlansService,
    private readonly catalog: CurriculumService,
    private readonly rules: RulesService,
  ) {}

  async shareOf(userId: string, planId: string): Promise<PlanShareDto | null> {
    await this.plans.get(userId, planId);
    const [row]: ShareRow[] = await this.db.query(`SELECT ${SHARE_COLUMNS} FROM "plan_shares" WHERE "plan_id" = $1 AND "user_id" = $2`, [planId, userId]);
    return row ? toShareDto(row) : null;
  }

  async share(userId: string, planId: string, choices: ShareChoices = {}): Promise<PlanShareDto> {
    await this.plans.get(userId, planId);
    let rows: ShareRow[];
    try {
      rows = await this.db.transaction(async (tx) => {
        const [active] = await tx.query('SELECT 1 FROM "users" WHERE "id" = $1 AND "deletion_requested_at" IS NULL FOR SHARE', [userId]);
        if (!active) return [];
        return tx.query(
          `INSERT INTO "plan_shares" ("plan_id", "user_id", "share_token", "show_name", "show_transcript_checks")
           VALUES ($1, $2, $3, COALESCE($4::boolean, false), COALESCE($5::boolean, false))
           ON CONFLICT ("plan_id") DO UPDATE SET
             "show_name" = COALESCE($4::boolean, "plan_shares"."show_name"),
             "show_transcript_checks" = COALESCE($5::boolean, "plan_shares"."show_transcript_checks")
           WHERE "plan_shares"."user_id" = EXCLUDED."user_id"
           RETURNING ${SHARE_COLUMNS}`,
          [planId, userId, newShareToken(), choices.showName ?? null, choices.showTranscriptChecks ?? null],
        );
      });
    } catch (error) {
      if (isRefusal(error, [SQLSTATE.foreignKeyViolation])) throw planNotFound();
      throw error;
    }
    if (!rows[0]) throw planNotFound();
    return toShareDto(rows[0]);
  }

  async stop(userId: string, planId: string): Promise<void> {
    await this.plans.get(userId, planId);
    await this.db.getRepository(PlanShare).delete({ planId, userId });
  }

  async stopAllWithin(manager: EntityManager, userId: string): Promise<void> {
    await manager.delete(PlanShare, { userId });
  }

  async read(token: string): Promise<SharedPlanDto> {
    if (!isShareToken(token)) throw notShared();
    const [share]: { planId: string; userId: string; ownerName: string | null; showTranscriptChecks: boolean }[] = await this.db.query(
      `SELECT s."plan_id" AS "planId", s."user_id" AS "userId", s."show_transcript_checks" AS "showTranscriptChecks",
              CASE WHEN s."show_name" THEN u."display_name" END AS "ownerName"
       FROM "plan_shares" s JOIN "users" u ON u."id" = s."user_id"
       WHERE s."share_token" = $1 AND u."deletion_requested_at" IS NULL`,
      [token],
    );
    if (!share) throw notShared();
    const plan = await this.plans.find(share.userId, share.planId);
    if (!plan) throw notShared();
    const showTranscriptChecks = share.showTranscriptChecks === true;
    const [report, courses, curriculum] = await Promise.all([
      this.rules.issuesFor(plan, showTranscriptChecks ? share.userId : null),
      this.catalog.catalogCourses(courseCodesOf(plan.terms)),
      this.catalog.curriculumLabels(plan.curriculum.id),
    ]);
    if (!curriculum) throw new Error('The curriculum of a shared plan is missing');
    return sharedPlan({ plan, report, courses, curriculum, ownerName: share.ownerName, showTranscriptChecks });
  }
}
