import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, scores, emailDrafts } from "@/lib/db/schema";
import { CandidateActions } from "./CandidateActions";

export const dynamic = "force-dynamic";

const CRITERIA: { key: "a" | "b" | "c" | "d" | "e" | "f"; label: string; max: number }[] = [
  { key: "a", label: "Operational domain fluency", max: 25 },
  { key: "b", label: "Zero-to-one ownership under ambiguity", max: 20 },
  { key: "c", label: "Shipped-and-measured outcomes", max: 20 },
  { key: "d", label: "Independent judgment under pressure", max: 15 },
  { key: "e", label: "Multiplier effect", max: 10 },
  { key: "f", label: "Role-scope fit", max: 10 },
];

const CRITERION_COLUMN = {
  a: "criterionA",
  b: "criterionB",
  c: "criterionC",
  d: "criterionD",
  e: "criterionE",
  f: "criterionF",
} as const;

const BAND_META: Record<string, { badge: string; bar: string; gradient: string }> = {
  advance: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-400", gradient: "from-emerald-500 to-emerald-400" },
  hold: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400", gradient: "from-amber-500 to-amber-400" },
  decline: { badge: "bg-rose-100 text-rose-700", bar: "bg-rose-300", gradient: "from-rose-400 to-rose-300" },
};

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
  if (!candidate) notFound();

  const [score] = await db.select().from(scores).where(eq(scores.candidateId, id));
  const drafts = await db.select().from(emailDrafts).where(eq(emailDrafts.candidateId, id)).orderBy(desc(emailDrafts.createdAt));

  const evidence = (score?.evidence ?? {}) as Record<string, string>;
  const confidenceFlags = (score?.confidenceFlags ?? {}) as Record<string, boolean>;
  const probeQuestions = (score?.probeQuestions ?? []) as string[];
  const meta = score ? BAND_META[score.band] : null;

  return (
    <div className="animate-fade-in-up space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-indigo-600">
        ← Back to shortlist
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold text-slate-900">{candidate.name ?? candidate.sourceFilename}</h1>
          <p className="text-sm text-slate-500">
            {candidate.email ?? "no email"} · <span className="font-medium text-indigo-600">{candidate.roleTarget}</span> ·{" "}
            {candidate.sourceFilename}
          </p>
          {candidate.isDuplicateOf && (
            <p className="mt-1 text-sm text-rose-700">Flagged as a duplicate of another candidate in the system.</p>
          )}
          {candidate.interviewNotes && (
            <p className="mt-2 rounded-lg bg-indigo-50 p-2 text-sm text-indigo-900">{candidate.interviewNotes}</p>
          )}
        </div>
        {score && (
          <div
            className={`flex shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${meta!.gradient} px-6 py-3 text-white shadow-md`}
          >
            <span className="font-heading text-2xl font-bold leading-none">{score.total}</span>
            <span className="text-[10px] uppercase tracking-wide text-white/80">/ 100</span>
          </div>
        )}
      </div>

      {score ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-slate-50/60 px-5 py-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${meta!.badge}`}>
                {score.band}
                {score.gateTriggered ? " · gated" : ""}
              </span>
              <span className="text-xs text-slate-400">Rubric v1</span>
            </div>
            <div className="px-5 pt-4 pb-1 text-sm text-slate-700">{score.rationale}</div>
            <div className="divide-y divide-[var(--color-border)]">
              {CRITERIA.map((c) => {
                const value = score[CRITERION_COLUMN[c.key]] as number;
                const pct = Math.round((value / c.max) * 100);
                return (
                  <div key={c.key} className="px-5 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">
                        <span className="mr-1 text-indigo-500">({c.key})</span> {c.label}
                      </span>
                      <span className="text-slate-600">
                        {value}/{c.max}
                        {confidenceFlags[c.key] && (
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            thin evidence
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${meta!.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {evidence[c.key] && (
                      <blockquote className="mt-2 rounded-lg border-l-2 border-indigo-200 bg-indigo-50/50 py-1.5 pl-3 text-sm italic text-slate-600">
                        &ldquo;{evidence[c.key]}&rdquo;
                      </blockquote>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Probe questions</h2>
            <ul className="space-y-2">
              {probeQuestions.map((q, i) => (
                <li key={i} className="flex gap-2 rounded-lg bg-orange-50/70 p-2.5 text-sm text-slate-700">
                  <span className="font-heading font-semibold text-orange-500">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-600">
          Not scored yet.
        </div>
      )}

      <CandidateActions
        candidateId={id}
        hasScore={!!score}
        suggestedBand={score?.band ?? null}
        drafts={drafts.map((d) => ({ id: d.id, kind: d.kind, subject: d.subject, body: d.body, status: d.status }))}
      />
    </div>
  );
}
