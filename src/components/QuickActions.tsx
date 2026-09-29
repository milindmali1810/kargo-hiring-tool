"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickActions({
  candidateId,
  candidateName,
  sentInvite,
  sentDecline,
}: {
  candidateId: string;
  candidateName: string;
  sentInvite: boolean;
  sentDecline: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"invite" | "decline" | null>(null);
  const [confirming, setConfirming] = useState<"invite" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: "invite" | "decline") {
    setConfirming(null);
    setLoading(kind);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/quick-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  if (confirming) {
    const verb = confirming === "invite" ? "Send invite" : "Send decline";
    return (
      <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-1 py-1">
          <span className="pl-1.5 text-xs text-slate-600">{verb} to {candidateName.split(" ")[0]}?</span>
          <button
            onClick={() => send(confirming)}
            className="cursor-pointer rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-700"
          >
            Yes, send
          </button>
          <button
            onClick={() => setConfirming(null)}
            className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-1.5">
        {sentInvite ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Invited ✓
          </span>
        ) : (
          <button
            onClick={() => setConfirming("invite")}
            disabled={loading !== null || sentDecline}
            title={sentDecline ? "Already declined" : undefined}
            className="cursor-pointer rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === "invite" ? "Sending…" : "Invite"}
          </button>
        )}
        {sentDecline ? (
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">Declined</span>
        ) : (
          <button
            onClick={() => setConfirming("decline")}
            disabled={loading !== null || sentInvite}
            title={sentInvite ? "Already invited" : undefined}
            className="cursor-pointer rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading === "decline" ? "Sending…" : "Reject"}
          </button>
        )}
      </div>
      {error && <p className="max-w-[180px] text-right text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
