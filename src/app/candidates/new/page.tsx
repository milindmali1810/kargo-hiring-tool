"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCandidatePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<"" | "PM" | "SPM">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    if (role) form.append("role", role);
    if (notes) form.append("interview_notes", notes);

    try {
      const res = await fetch("/api/candidates", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      router.push(`/candidates/${data.candidateId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Add a candidate</h1>
        <p className="text-sm text-slate-500">
          Use this any time — right after taking an interview, or when a new resume comes in. It goes
          through the same parsing, deduplication, and role-tagging as the original batch, then you can
          score it from the candidate page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Resume (PDF or DOCX)</label>
          <input
            type="file"
            accept=".pdf,.docx"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Role applied for</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "" | "PM" | "SPM")}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Let the tool tag it (best-fit against both JDs)</option>
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Interview notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Anything from the conversation worth keeping alongside the CV evidence"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !file}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Add candidate"}
        </button>
      </form>
    </div>
  );
}
