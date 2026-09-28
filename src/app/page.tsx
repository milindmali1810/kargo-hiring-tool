import Link from "next/link";
import { db } from "@/lib/db/client";
import { candidates, scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const BAND_ORDER: Record<string, number> = { advance: 0, hold: 1, decline: 2 };
const BAND_STYLES: Record<string, string> = {
  advance: "bg-emerald-100 text-emerald-800",
  hold: "bg-amber-100 text-amber-800",
  decline: "bg-slate-200 text-slate-700",
};

export default async function DashboardPage() {
  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      roleTarget: candidates.roleTarget,
      isDuplicateOf: candidates.isDuplicateOf,
      sourceFilename: candidates.sourceFilename,
      total: scores.total,
      band: scores.band,
      gateTriggered: scores.gateTriggered,
    })
    .from(candidates)
    .leftJoin(scores, eq(scores.candidateId, candidates.id));

  const scored = rows
    .filter((r) => r.band !== null)
    .sort((a, b) => {
      const bandDiff = BAND_ORDER[a.band!] - BAND_ORDER[b.band!];
      if (bandDiff !== 0) return bandDiff;
      return (b.total ?? 0) - (a.total ?? 0);
    });
  const pending = rows.filter((r) => r.band === null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>This ranking is a documented hypothesis, not a validated predictor.</strong> It comes from
        just 8 past hires — only 2 of them actually hired as Product Manager — scored with a gate rule
        calibrated to match Arjun&apos;s own past judgments, not a pure additive model. A low score is a
        signal to probe in interview, not an automatic disqualifier.
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Shortlist ({scored.length} scored)</h1>
        <Link href="/candidates/new" className="text-sm font-medium text-slate-900 underline">
          + Add candidate
        </Link>
      </div>

      <div className="space-y-3">
        {scored.map((c) => (
          <Link
            key={c.id}
            href={`/candidates/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{c.name ?? c.sourceFilename}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{c.roleTarget}</span>
                {c.isDuplicateOf && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700">duplicate</span>
                )}
              </div>
              <div className="text-xs text-slate-500">{c.sourceFilename}</div>
            </div>
            <div className="flex items-center gap-3">
              {c.gateTriggered && (
                <span className="text-xs text-slate-500" title="Gated: (a)+(b) < 15/45">
                  gated
                </span>
              )}
              <span className="text-sm font-semibold text-slate-900">{c.total}/100</span>
              <span className={`rounded px-2 py-1 text-xs font-medium capitalize ${BAND_STYLES[c.band!]}`}>
                {c.band}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Pending scoring ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((c) => (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="block rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600 hover:border-slate-400"
              >
                {c.name ?? c.sourceFilename} — {c.roleTarget}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
