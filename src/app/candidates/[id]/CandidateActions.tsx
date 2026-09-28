"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Draft = {
  id: string;
  kind: "invite" | "decline";
  subject: string;
  body: string;
  status: "draft" | "sent";
};

export function CandidateActions({
  candidateId,
  hasScore,
  drafts,
}: {
  candidateId: string;
  hasScore: boolean;
  suggestedBand: string | null;
  drafts: Draft[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>(
    Object.fromEntries(drafts.map((d) => [d.id, { subject: d.subject, body: d.body }]))
  );

  async function runAction(key: string, fn: () => Promise<Response>) {
    setLoading(key);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function saveDraftEdits(draft: Draft) {
    const edited = edits[draft.id];
    await runAction(`save-${draft.id}`, () =>
      fetch(`/api/email-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      })
    );
  }

  async function sendDraft(draft: Draft) {
    if (!confirm(`Send this ${draft.kind} email now? This cannot be undone.`)) return;
    await runAction(`send-${draft.id}`, () =>
      fetch(`/api/candidates/${candidateId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, confirm: true }),
      })
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {!hasScore ? (
        <button
          onClick={() => runAction("score", () => fetch(`/api/candidates/${candidateId}/score`, { method: "POST" }))}
          disabled={loading === "score"}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "score" ? "Scoring..." : "Score this candidate"}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() =>
              runAction("draft-invite", () =>
                fetch(`/api/candidates/${candidateId}/draft-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kind: "invite" }),
                })
              )
            }
            disabled={loading === "draft-invite"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            Draft interview invite
          </button>
          <button
            onClick={() =>
              runAction("draft-decline", () =>
                fetch(`/api/candidates/${candidateId}/draft-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kind: "decline" }),
                })
              )
            }
            disabled={loading === "draft-decline"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            Draft decline
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-4">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-slate-500">{d.kind}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    d.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <input
                className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-sm font-medium"
                value={edits[d.id]?.subject ?? d.subject}
                disabled={d.status === "sent"}
                onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], subject: e.target.value } }))}
              />
              <textarea
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                rows={5}
                disabled={d.status === "sent"}
                value={edits[d.id]?.body ?? d.body}
                onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], body: e.target.value } }))}
              />
              {d.status === "draft" && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => saveDraftEdits(d)}
                    disabled={loading === `save-${d.id}`}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800"
                  >
                    Save edits
                  </button>
                  <button
                    onClick={() => sendDraft(d)}
                    disabled={loading === `send-${d.id}`}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {loading === `send-${d.id}` ? "Sending..." : "Send"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
