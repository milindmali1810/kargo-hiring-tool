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
    <div className="animate-fade-in-up mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Add a candidate</h1>
        <p className="text-sm text-slate-500">
          Use this any time — right after taking an interview, or when a new resume comes in. It goes
          through the same parsing, deduplication, and role-tagging as the original batch, then you can
          score it from the candidate page.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">Resume (PDF or DOCX)</label>
          <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-orange-500 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
              </svg>
            </span>
            <span className="text-sm font-medium text-indigo-700">{file ? file.name : "Click to choose a file"}</span>
            <span className="text-xs text-slate-400">PDF or DOCX</span>
            <input
              type="file"
              accept=".pdf,.docx"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Role applied for</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "" | "PM" | "SPM")}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="Anything from the conversation worth keeping alongside the CV evidence"
          />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={loading || !file}
          className="w-full cursor-pointer rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-all duration-150 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Add candidate"}
        </button>
      </form>
    </div>
  );
}
