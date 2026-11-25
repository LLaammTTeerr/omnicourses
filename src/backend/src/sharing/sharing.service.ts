import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { courseCodesOf } from '../plans/plan-board.js';
import { PLAN_ISSUES_PROVIDER, type PlanIssuesProvider } from '../plans/plan-issues.js';
import { PlansService } from '../plans/plans.service.js';
import { PlanShare } from './plan-share.entity.js';
import { isShareToken, newShareToken } from './share-token.js';
import { sharedPlan } from './shared-plan.js';
import { NOT_SHARED_MESSAGE, PlanShareDto, SharedPlanDto } from './sharing.dto.js';

/** The one answer to every link that opens no plan (UC-09 A2, A6, A7, A8), so a link reveals nothing about what existed. */
const notShared = () => new NotFoundException(NOT_SHARED_MESSAGE);
/** As PlansService answers for a plan that is missing or someone else's. */
const noPlan = () => new NotFoundException('No plan with this id');

const FOREIGN_KEY_VIOLATION = '23503';

interface ShareRow {
  share_token: string;
  show_name: boolean;
  show_transcript_checks: boolean;
  created_at: Date;
}
const toDto = (row: ShareRow): PlanShareDto => ({ token: row.share_token, showName: row.show_name, showTranscriptChecks: row.show_transcript_checks, createdAt: row.created_at });
const SHARE_COLUMNS = '"share_token", "show_name", "show_transcript_checks", "created_at"';

/** The owner's choices for a link. A choice left out keeps what the link has, and is off on a new link. */
export interface ShareChoices {
  showName?: boolean;
  showTranscriptChecks?: boolean;
}

// F9 shared plans (UC-09, ADR 0010). The owner creates, reads and stops the one live link of a
// plan; anyone who holds the link's token reads the plan. This module writes only its own table
// and reads plans only through PlansService.find and get. It decides no academic rule: the issues
// come from the rule engine (AGENTS.md hard rule 1).
@Injectable()
export class SharingService {
  constructor(
    private readonly db: DataSource,
    private readonly plans: PlansService,
    private readonly catalog: CurriculumService,
    @Inject(PLAN_ISSUES_PROVIDER) private readonly issues: PlanIssuesProvider,
  ) {}

  /** The live link of one of the student's plans, or null when it is not shared. 404 for a plan that is not theirs. */
  async shareOf(userId: string, planId: string): Promise<PlanShareDto | null> {
    await this.plans.get(userId, planId);
    const [row]: ShareRow[] = await this.db.query(`SELECT ${SHARE_COLUMNS} FROM "plan_shares" WHERE "plan_id" = $1 AND "user_id" = $2`, [planId, userId]);
    return row ? toDto(row) : null;
  }

  /**
   * Shares one of the student's plans. A plan already shared keeps its link (UC-09 A4) and takes
   * the choices that are sent; a plan not shared gets a new token, so a link stopped earlier stays
   * dead (A3). Only an explicit true turns a choice on.
   */
  async share(userId: string, planId: string, choices: ShareChoices = {}): Promise<PlanShareDto> {
    await this.plans.get(userId, planId);
    let rows: ShareRow[];
    try {
      rows = await this.db.transaction(async (tx) => {
        // An account waiting for deletion has no link (A7). FOR SHARE makes this wait for a deletion
        // request in progress on the same account, or makes that request wait for this insert and
        // then delete it: either way no link outlives the request.
        const [active] = await tx.query('SELECT 1 FROM "users" WHERE "id" = $1 AND "deletion_requested_at" IS NULL FOR SHARE', [userId]);
        if (!active) return [];
        // One statement: two requests at once end with one row and the same token. A choice that
        // was not sent (null) is off on a new row and unchanged on a live one. The WHERE keeps the
        // update on the caller's own row, whatever the check above saw.
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
      // The plan was deleted between the check and the insert: the composite key to plans refuses the row.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === FOREIGN_KEY_VIOLATION) throw noPlan();
      throw error;
    }
    if (!rows[0]) throw noPlan();
    return toDto(rows[0]);
  }

  /** Stops sharing: the link is dead at once (UC-09 A2). Nothing happens when the plan is not shared. 404 for a plan that is not theirs. */
  async stop(userId: string, planId: string): Promise<void> {
    await this.plans.get(userId, planId);
    await this.db.getRepository(PlanShare).delete({ planId, userId });
  }

  /** Stops every link of the account, inside the caller's transaction: a deletion request stops them like the sessions (UC-09 A7). */
  async stopAllWithin(manager: EntityManager, userId: string): Promise<void> {
    await manager.delete(PlanShare, { userId });
  }

  /**
   * The plan a link's token opens, as it is now (UC-09 A5), or the one "not shared" answer. It
   * writes nothing, and its work is bounded by the size of one plan.
   */
  async read(token: string): Promise<SharedPlanDto> {
    if (!isShareToken(token)) throw notShared();
    // display_name is read only when the owner chose to show it. An account waiting for deletion opens nothing (A7).
    const [share]: { planId: string; userId: string; ownerName: string | null; showTranscriptChecks: boolean }[] = await this.db.query(
      `SELECT s."plan_id" AS "planId", s."user_id" AS "userId", s."show_transcript_checks" AS "showTranscriptChecks",
              CASE WHEN s."show_name" THEN u."display_name" END AS "ownerName"
       FROM "plan_shares" s JOIN "users" u ON u."id" = s."user_id"
       WHERE s."share_token" = $1 AND u."deletion_requested_at" IS NULL`,
      [token],
    );
    if (!share) throw notShared();
    const plan = await this.plans.find(share.userId, share.planId);
    // Deleted since the row was read.
    if (!plan) throw notShared();
    const [report, courses, curriculum] = await Promise.all([
      this.issues.issuesFor(share.userId, plan),
      this.catalog.courseSummaries(courseCodesOf(plan.terms)),
      this.catalog.curriculumLabels(plan.curriculum.id),
    ]);
    // ON DELETE RESTRICT keeps a plan's curriculum (ADR 0014), so this is a broken invariant.
    if (!curriculum) throw new Error('The curriculum of a shared plan is missing');
    // Only an explicit true from the row shows the transcript's checks.
    return sharedPlan({ plan, report, courses, curriculum, ownerName: share.ownerName, showTranscriptChecks: share.showTranscriptChecks === true });
  }
}
