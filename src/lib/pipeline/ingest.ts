import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";
import { extractText } from "./extractText";
import { normalize } from "./normalize";
import { contentHash, findDuplicate } from "./dedupe";
import { tagRole } from "./tagRole";

export interface IngestOptions {
  file: Buffer;
  filename: string;
  /** Filename-derived role tag (e.g. from a `pm_`/`spm_` prefix), if one exists. */
  filenameRoleTag: "PM" | "SPM" | null;
  pmJD: string;
  spmJD: string;
  addedVia: "seed" | "manual_add";
}

export interface IngestResult {
  candidateId: string;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  roleTarget: "PM" | "SPM" | "unclear";
}

/**
 * Stage 1 pipeline: parse -> normalize/strip PII -> dedupe -> tag role -> store.
 * Shared by the initial 60-CV seed and by the "add a new candidate" flow, so a
 * candidate added the day after an interview goes through exactly the same
 * process as the original batch.
 */
export async function ingestCandidate(opts: IngestOptions): Promise<IngestResult> {
  const rawText = await extractText(opts.file, opts.filename);
  const normalized = await normalize(rawText);
  const hash = contentHash(normalized.clean_text);

  const existing = await db
    .select({ id: candidates.id, name: candidates.name, email: candidates.email, phone: candidates.phone, content_hash: candidates.contentHash })
    .from(candidates);

  const duplicateOfId = findDuplicate(
    { name: normalized.name, email: normalized.email, phone: normalized.phone, contentHash: hash },
    existing
  );

  let roleTarget: "PM" | "SPM" | "unclear";
  let taggingRationale: string | null = null;
  if (opts.filenameRoleTag) {
    roleTarget = opts.filenameRoleTag;
  } else {
    const tagged = await tagRole(normalized.clean_text, opts.pmJD, opts.spmJD);
    roleTarget = tagged.role_target;
    taggingRationale = tagged.reason;
  }

  const [inserted] = await db
    .insert(candidates)
    .values({
      sourceFilename: opts.filename,
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      roleTarget,
      taggingRationale,
      rawText,
      cleanText: normalized.clean_text,
      rolesHeld: normalized.roles_held,
      yearsExperience: normalized.years_experience?.toString(),
      achievementBullets: normalized.achievement_bullets,
      contentHash: hash,
      isDuplicateOf: duplicateOfId,
      status: "pending_score",
      addedVia: opts.addedVia,
    })
    .returning({ id: candidates.id });

  return {
    candidateId: inserted.id,
    isDuplicate: duplicateOfId !== null,
    duplicateOfId,
    roleTarget,
  };
}
