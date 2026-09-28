import { createHash } from "crypto";

export function contentHash(cleanText: string): string {
  const normalized = cleanText.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ");
}

/**
 * Two-tier duplicate check against already-stored candidates:
 * 1. Exact content hash match (identical CV text — e.g. the same file re-uploaded).
 * 2. Fuzzy name match + shared email/phone (a resubmission with minor edits).
 * Returns the id of the existing candidate this one duplicates, or null.
 */
export function findDuplicate(
  candidate: { name: string | null; email: string | null; phone: string | null; contentHash: string },
  existing: { id: string; name: string | null; email: string | null; phone: string | null; content_hash: string }[]
): string | null {
  const exact = existing.find((e) => e.content_hash === candidate.contentHash);
  if (exact) return exact.id;

  if (candidate.name) {
    const normName = normalizeName(candidate.name);
    for (const e of existing) {
      if (!e.name) continue;
      const dist = levenshtein(normName, normalizeName(e.name));
      const sameContact =
        (!!candidate.email && candidate.email === e.email) ||
        (!!candidate.phone && candidate.phone === e.phone);
      // Close name match (allowing for typos/formatting) plus matching contact info
      if (dist <= 2 && sameContact) return e.id;
    }
  }

  return null;
}
