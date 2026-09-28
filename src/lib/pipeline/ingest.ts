import type { SupabaseClient } from "@supabase/supabase-js";
import { extractText } from "./extractText";
import { normalize } from "./normalize";
import { contentHash, findDuplicate } from "./dedupe";
import { tagRole } from "./tagRole";

export interface IngestOptions {
  supabase: SupabaseClient;
  file: Buffer;
  filename: string;
  storagePath: string | null;
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

  const { data: existing, error: existingErr } = await opts.supabase
    .from("candidates")
    .select("id, name, email, phone, content_hash");
  if (existingErr) throw existingErr;

  const duplicateOfId = findDuplicate(
    { name: normalized.name, email: normalized.email, phone: normalized.phone, contentHash: hash },
    existing ?? []
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

  const { data: inserted, error: insertErr } = await opts.supabase
    .from("candidates")
    .insert({
      source_filename: opts.filename,
      storage_path: opts.storagePath,
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      role_target: roleTarget,
      tagging_rationale: taggingRationale,
      raw_text: rawText,
      clean_text: normalized.clean_text,
      roles_held: normalized.roles_held,
      years_experience: normalized.years_experience,
      achievement_bullets: normalized.achievement_bullets,
      content_hash: hash,
      is_duplicate_of: duplicateOfId,
      status: "pending_score",
      added_via: opts.addedVia,
    })
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  return {
    candidateId: inserted.id,
    isDuplicate: duplicateOfId !== null,
    duplicateOfId,
    roleTarget,
  };
}
