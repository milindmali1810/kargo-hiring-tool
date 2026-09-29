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
  roleTarget,
  drafts,
}: {
  candidateId: string;
  hasScore: boolean;
  roleTarget: "PM" | "SPM" | "unclear";
  suggestedBand: string | null;
  drafts: Draft[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<"PM" | "SPM">("PM");
  const [confirmingSend, setConfirmingSend] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>(
    Object.fromEntries(drafts.map((d) => [d.id, { subject: d.subject, body: d.body }]))
  );

  const alreadySentInvite = drafts.some((d) => d.kind === "invite" && d.status === "sent");
  const alreadySentDecline = drafts.some((d) => d.kind === "decline" && d.status === "sent");

  async function assignRole() {
    await runAction("assign-role", () =>
      fetch(`/api/candidates/${candidateId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingRole }),
      })
    );
  }

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
    setConfirmingSend(null);
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
      {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}

      {roleTarget === "unclear" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-sm text-amber-900">
            No clear PM/SPM fit was tagged — assign a role before scoring:
          </span>
          <select
            value={pendingRole}
            onChange={(e) => setPendingRole(e.target.value as "PM" | "SPM")}
            className="cursor-pointer rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          >
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
          <button
            onClick={assignRole}
            disabled={loading === "assign-role"}
            className="cursor-pointer rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === "assign-role" ? "Saving..." : "Assign role"}
          </button>
        </div>
      ) : !hasScore ? (
        <button
          onClick={() => runAction("score", () => fetch(`/api/candidates/${candidateId}/score`, { method: "POST" }))}
          disabled={loading === "score"}
          className="cursor-pointer rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all duration-150 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "score" ? "Scoring..." : "Score this candidate"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={loading === "draft-invite" || alreadySentInvite || alreadySentDecline}
            title={alreadySentDecline ? "Already declined" : undefined}
            className="cursor-pointer rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
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
            disabled={loading === "draft-decline" || alreadySentDecline || alreadySentInvite}
            title={alreadySentInvite ? "Already invited" : undefined}
            className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Draft decline
          </button>
          {alreadySentInvite && <span className="text-xs text-emerald-600">Invite already sent ✓</span>}
          {alreadySentDecline && <span className="text-xs text-slate-500">Decline already sent</span>}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-4">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {d.kind}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <input
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium outline-none transition-shadow focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                value={edits[d.id]?.subject ?? d.subject}
                disabled={d.status === "sent"}
                onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], subject: e.target.value } }))}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none transition-shadow focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                rows={5}
                disabled={d.status === "sent"}
                value={edits[d.id]?.body ?? d.body}
                onChange={(e) => setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], body: e.target.value } }))}
              />
              {d.status === "draft" && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => saveDraftEdits(d)}
                    disabled={loading === `save-${d.id}`}
                    className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save edits
                  </button>
                  {confirmingSend === d.id ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-1 py-1">
                      <span className="pl-1.5 text-xs text-slate-600">Send now?</span>
                      <button
                        onClick={() => sendDraft(d)}
                        className="cursor-pointer rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        Yes, send
                      </button>
                      <button
                        onClick={() => setConfirmingSend(null)}
                        className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingSend(d.id)}
                      disabled={loading === `send-${d.id}`}
                      className="cursor-pointer rounded-full bg-gradient-to-r from-orange-600 to-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-orange-600/20 transition-all hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading === `send-${d.id}` ? "Sending..." : "Send"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
