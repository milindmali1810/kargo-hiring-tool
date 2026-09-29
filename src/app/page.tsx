import Link from "next/link";
import { db } from "@/lib/db/client";
import { candidates, scores, emailDrafts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { QuickActions } from "@/components/QuickActions";

export const dynamic = "force-dynamic";

const BAND_ORDER: Record<string, number> = { advance: 0, hold: 1, decline: 2 };

const BAND_META: Record<string, { badge: string; bar: string; ring: string; label: string }> = {
  advance: {
    badge: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-400",
    ring: "ring-emerald-200",
    label: "Advance",
  },
  hold: {
    badge: "bg-amber-100 text-amber-700",
    bar: "bg-amber-400",
    ring: "ring-amber-200",
    label: "Hold",
  },
  decline: {
    badge: "bg-rose-100 text-rose-700",
    bar: "bg-rose-300",
    ring: "ring-rose-100",
    label: "Decline",
  },
};

const CRITERIA = [
  { key: "criterionA", letter: "A", label: "Operational domain fluency", max: 25 },
  { key: "criterionB", letter: "B", label: "Zero-to-one ownership under ambiguity", max: 20 },
  { key: "criterionC", letter: "C", label: "Shipped-and-measured outcomes", max: 20 },
  { key: "criterionD", letter: "D", label: "Independent judgment under pressure", max: 15 },
  { key: "criterionE", letter: "E", label: "Multiplier effect", max: 10 },
  { key: "criterionF", letter: "F", label: "Role-scope fit", max: 10 },
] as const;

function chipColor(pct: number): string {
  if (pct >= 0.7) return "bg-emerald-50 text-emerald-700";
  if (pct >= 0.4) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-600";
}

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
      criterionA: scores.criterionA,
      criterionB: scores.criterionB,
      criterionC: scores.criterionC,
      criterionD: scores.criterionD,
      criterionE: scores.criterionE,
      criterionF: scores.criterionF,
    })
    .from(candidates)
    .leftJoin(scores, eq(scores.candidateId, candidates.id));

  const draftRows = await db.select({ candidateId: emailDrafts.candidateId, kind: emailDrafts.kind, status: emailDrafts.status }).from(emailDrafts);
  const sentByCandidate = new Map<string, { invite: boolean; decline: boolean }>();
  for (const d of draftRows) {
    if (d.status !== "sent") continue;
    const entry = sentByCandidate.get(d.candidateId) ?? { invite: false, decline: false };
    if (d.kind === "invite") entry.invite = true;
    if (d.kind === "decline") entry.decline = true;
    sentByCandidate.set(d.candidateId, entry);
  }

  const scored = rows
    .filter((r) => r.band !== null)
    .sort((a, b) => {
      const bandDiff = BAND_ORDER[a.band!] - BAND_ORDER[b.band!];
      if (bandDiff !== 0) return bandDiff;
      return (b.total ?? 0) - (a.total ?? 0);
    });
  const pending = rows.filter((r) => r.band === null);

  const counts = {
    advance: scored.filter((c) => c.band === "advance").length,
    hold: scored.filter((c) => c.band === "hold").length,
    decline: scored.filter((c) => c.band === "decline").length,
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-500 to-orange-400 p-5 text-sm text-white shadow-lg shadow-indigo-600/15">
        <strong className="font-heading text-base">This ranking is a documented hypothesis, not a validated predictor.</strong>
        <p className="mt-1 text-indigo-50">
          It comes from just 8 past hires — only 2 of them actually hired as Product Manager — scored
          with a gate rule calibrated to match Arjun&apos;s own past judgments, not a pure additive model.
          A low score is a signal to probe in interview, not an automatic disqualifier.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold text-slate-900">Shortlist</h1>
          <p className="text-sm text-slate-500">{scored.length} scored candidates</p>
        </div>
        <Link
          href="/candidates/new"
          className="cursor-pointer rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all duration-150 hover:shadow-md active:scale-[0.98]"
        >
          + Add candidate
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["advance", "hold", "decline"] as const).map((band) => (
          <div
            key={band}
            className={`rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm ring-1 ${BAND_META[band].ring}`}
          >
            <div className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BAND_META[band].badge}`}>
              {BAND_META[band].label}
            </div>
            <div className="mt-2 font-heading text-2xl font-semibold text-slate-900">{counts[band]}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {scored.map((c, i) => {
          const meta = BAND_META[c.band!];
          const sent = sentByCandidate.get(c.id) ?? { invite: false, decline: false };
          return (
            <div
              key={c.id}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
              className="animate-fade-in-up group flex items-center gap-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={`/candidates/${c.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className={`h-10 w-1.5 shrink-0 rounded-full ${meta.bar}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 group-hover:text-indigo-700">
                      {c.name ?? c.sourceFilename}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {c.roleTarget}
                    </span>
                    {c.isDuplicateOf && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">duplicate</span>
                    )}
                    {c.gateTriggered && (
                      <span className="text-xs text-slate-400" title="Gated: (a)+(b) < 15/45">
                        gated
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {CRITERIA.map((crit) => {
                      const value = c[crit.key] as number;
                      const pct = value / crit.max;
                      return (
                        <span
                          key={crit.key}
                          title={`${crit.label}: ${value}/${crit.max}`}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${chipColor(pct)}`}
                        >
                          {crit.letter}
                          {value}
                        </span>
                      );
                    })}
                    <span className="ml-1 truncate text-xs text-slate-400">{c.sourceFilename}</span>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-sm font-semibold text-slate-900">{c.total}/100</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                </div>
                <QuickActions
                  candidateId={c.id}
                  candidateName={c.name ?? c.sourceFilename}
                  sentInvite={sent.invite}
                  sentDecline={sent.decline}
                />
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Pending scoring ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((c) => (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white/60 p-3 text-sm text-slate-600 transition-colors duration-150 hover:border-indigo-300 hover:bg-white"
              >
                <span>{c.name ?? c.sourceFilename}</span>
                {c.roleTarget === "unclear" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    needs role
                  </span>
                ) : (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {c.roleTarget}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
