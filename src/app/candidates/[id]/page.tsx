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

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
  if (!candidate) notFound();

  const [score] = await db.select().from(scores).where(eq(scores.candidateId, id));
  const drafts = await db.select().from(emailDrafts).where(eq(emailDrafts.candidateId, id)).orderBy(desc(emailDrafts.createdAt));

  const evidence = (score?.evidence ?? {}) as Record<string, string>;
  const confidenceFlags = (score?.confidenceFlags ?? {}) as Record<string, boolean>;
  const probeQuestions = (score?.probeQuestions ?? []) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{candidate.name ?? candidate.sourceFilename}</h1>
        <p className="text-sm text-slate-500">
          {candidate.email ?? "no email"} · {candidate.roleTarget} · {candidate.sourceFilename}
        </p>
        {candidate.isDuplicateOf && (
          <p className="mt-1 text-sm text-rose-700">Flagged as a duplicate of another candidate in the system.</p>
        )}
        {candidate.interviewNotes && (
          <p className="mt-2 rounded bg-slate-100 p-2 text-sm text-slate-700">{candidate.interviewNotes}</p>
        )}
      </div>

      {score ? (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-semibold">{score.total}/100</span>
              <span className="rounded px-2 py-1 text-xs font-medium capitalize bg-slate-100">
                {score.band}
                {score.gateTriggered ? " (gated)" : ""}
              </span>
            </div>
            <p className="mb-4 text-sm text-slate-700">{score.rationale}</p>
            <div className="space-y-3">
              {CRITERIA.map((c) => (
                <div key={c.key} className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">
                      ({c.key}) {c.label}
                    </span>
                    <span className="text-slate-600">
                      {score[CRITERION_COLUMN[c.key]]}/{c.max}
                      {confidenceFlags[c.key] && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          thin evidence
                        </span>
                      )}
                    </span>
                  </div>
                  {evidence[c.key] && (
                    <blockquote className="mt-1 border-l-2 border-slate-200 pl-3 text-sm italic text-slate-600">
                      &ldquo;{evidence[c.key]}&rdquo;
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Probe questions</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {probeQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
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
