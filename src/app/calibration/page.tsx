import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hires, hireScores } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const BAND_BADGE: Record<string, string> = {
  advance: "bg-emerald-100 text-emerald-700",
  hold: "bg-amber-100 text-amber-700",
  decline: "bg-rose-100 text-rose-700",
};

export default async function CalibrationPage() {
  const rows = await db
    .select({
      id: hires.id,
      name: hires.name,
      isPmHire: hires.isPmHire,
      actualOutcome: hires.actualOutcome,
      criterionA: hireScores.criterionA,
      criterionB: hireScores.criterionB,
      criterionC: hireScores.criterionC,
      criterionD: hireScores.criterionD,
      criterionE: hireScores.criterionE,
      criterionF: hireScores.criterionF,
      total: hireScores.total,
      band: hireScores.band,
      gateTriggered: hireScores.gateTriggered,
    })
    .from(hires)
    .leftJoin(hireScores, eq(hireScores.hireId, hires.id));

  const sorted = [...rows].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  return (
    <div className="animate-fade-in-up space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold text-slate-900">Calibration</h1>
        <p className="text-sm text-slate-500">
          The rubric was built from these 8 past hires — only Vikram Nair and Lavanya Iyer were actually
          hired as Product Manager. The other 6 are used only to extract a cross-functional success
          pattern. Rows with scores were produced by the same Gemini pipeline used on real applications, as
          a check that the scoring implementation matches the documented rubric before it&apos;s trusted on
          the shortlist.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-gradient-to-r from-indigo-50 to-orange-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">PM hire?</th>
              <th className="p-3">a</th>
              <th className="p-3">b</th>
              <th className="p-3">c</th>
              <th className="p-3">d</th>
              <th className="p-3">e</th>
              <th className="p-3">f</th>
              <th className="p-3">Total</th>
              <th className="p-3">Band</th>
              <th className="p-3">Actual outcome</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.id} className="border-t border-[var(--color-border)] transition-colors hover:bg-indigo-50/30">
                <td className="p-3 font-medium text-slate-900">{h.name}</td>
                <td className="p-3">
                  {h.isPmHire ? (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Yes</span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
                {h.total !== null ? (
                  <>
                    <td className="p-3 text-slate-600">{h.criterionA}</td>
                    <td className="p-3 text-slate-600">{h.criterionB}</td>
                    <td className="p-3 text-slate-600">{h.criterionC}</td>
                    <td className="p-3 text-slate-600">{h.criterionD}</td>
                    <td className="p-3 text-slate-600">{h.criterionE}</td>
                    <td className="p-3 text-slate-600">{h.criterionF}</td>
                    <td className="p-3 font-heading font-semibold text-slate-900">
                      {h.total}
                      {h.gateTriggered ? " *" : ""}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${BAND_BADGE[h.band!]}`}>
                        {h.band}
                      </span>
                    </td>
                  </>
                ) : (
                  <td className="p-3 text-slate-400" colSpan={8}>
                    not live-scored
                  </td>
                )}
                <td className="p-3 text-slate-600">{h.actualOutcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">* gated to &ldquo;hold&rdquo; regardless of total, per the (a)+(b) &lt; 15/45 rule.</p>
    </div>
  );
}
