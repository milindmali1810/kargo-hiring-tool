import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleTargetEnum = pgEnum("role_target", ["PM", "SPM", "unclear"]);
export const candidateStatusEnum = pgEnum("candidate_status", ["pending_score", "scored"]);
export const scoreBandEnum = pgEnum("score_band", ["advance", "hold", "decline"]);
export const emailKindEnum = pgEnum("email_kind", ["invite", "decline"]);
export const emailStatusEnum = pgEnum("email_status", ["draft", "sent"]);
export const addedViaEnum = pgEnum("added_via_type", ["seed", "manual_add"]);

// App-wide config / reference text (rubric + JDs), loaded once at seed time.
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceFilename: text("source_filename").notNull(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  roleTarget: roleTargetEnum("role_target").notNull().default("unclear"),
  taggingRationale: text("tagging_rationale"),
  rawText: text("raw_text").notNull(),
  cleanText: text("clean_text").notNull(),
  rolesHeld: jsonb("roles_held").notNull().default([]),
  yearsExperience: numeric("years_experience"),
  achievementBullets: jsonb("achievement_bullets").notNull().default([]),
  contentHash: text("content_hash").notNull(),
  isDuplicateOf: uuid("is_duplicate_of"),
  status: candidateStatusEnum("status").notNull().default("pending_score"),
  addedVia: addedViaEnum("added_via").notNull().default("manual_add"),
  interviewNotes: text("interview_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    criterionA: integer("criterion_a").notNull(),
    criterionB: integer("criterion_b").notNull(),
    criterionC: integer("criterion_c").notNull(),
    criterionD: integer("criterion_d").notNull(),
    criterionE: integer("criterion_e").notNull(),
    criterionF: integer("criterion_f").notNull(),
    total: integer("total").notNull(),
    gateTriggered: boolean("gate_triggered").notNull().default(false),
    band: scoreBandEnum("band").notNull(),
    rationale: text("rationale").notNull(),
    evidence: jsonb("evidence").notNull().default({}),
    confidenceFlags: jsonb("confidence_flags").notNull().default({}),
    probeQuestions: jsonb("probe_questions").notNull().default([]),
    modelVersion: text("model_version").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("scores_candidate_id_idx").on(table.candidateId)]
);

// Calibration reference set: the 8 known past hires. Never rescored as a live
// candidate, never shown in the main shortlist — only on /calibration.
export const hires = pgTable("hires", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceFilename: text("source_filename").notNull(),
  name: text("name").notNull(),
  isPmHire: boolean("is_pm_hire").notNull().default(false),
  actualOutcome: text("actual_outcome").notNull(),
  rawText: text("raw_text").notNull(),
  cleanText: text("clean_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hireScores = pgTable(
  "hire_scores",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    hireId: uuid("hire_id")
      .notNull()
      .references(() => hires.id, { onDelete: "cascade" }),
    criterionA: integer("criterion_a").notNull(),
    criterionB: integer("criterion_b").notNull(),
    criterionC: integer("criterion_c").notNull(),
    criterionD: integer("criterion_d").notNull(),
    criterionE: integer("criterion_e").notNull(),
    criterionF: integer("criterion_f").notNull(),
    total: integer("total").notNull(),
    gateTriggered: boolean("gate_triggered").notNull().default(false),
    band: scoreBandEnum("band").notNull(),
    rationale: text("rationale").notNull(),
    evidence: jsonb("evidence").notNull().default({}),
    confidenceFlags: jsonb("confidence_flags").notNull().default({}),
    probeQuestions: jsonb("probe_questions").notNull().default([]),
    modelVersion: text("model_version").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("hire_scores_hire_id_idx").on(table.hireId)]
);

export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  kind: emailKindEnum("kind").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: emailStatusEnum("status").notNull().default("draft"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  resendMessageId: text("resend_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
