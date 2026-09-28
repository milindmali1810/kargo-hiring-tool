import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hires, hireScores } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Calibration</h1>
        <p className="text-sm text-slate-500">
          The rubric was built from these 8 past hires — only Vikram Nair and Lavanya Iyer were actually
          hired as Product Manager. The other 6 are used only to extract a cross-functional success
          pattern. Rows with scores were produced by the same Gemini pipeline used on real applications, as
          a check that the scoring implementation matches the documented rubric before it&apos;s trusted on
          the shortlist.
        </p>
      </div>

      <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
            <tr key={h.id} className="border-t border-slate-100">
              <td className="p-3 font-medium text-slate-900">{h.name}</td>
              <td className="p-3">{h.isPmHire ? "Yes" : "No"}</td>
              {h.total !== null ? (
                <>
                  <td className="p-3">{h.criterionA}</td>
                  <td className="p-3">{h.criterionB}</td>
                  <td className="p-3">{h.criterionC}</td>
                  <td className="p-3">{h.criterionD}</td>
                  <td className="p-3">{h.criterionE}</td>
                  <td className="p-3">{h.criterionF}</td>
                  <td className="p-3 font-semibold">
                    {h.total}
                    {h.gateTriggered ? " *" : ""}
                  </td>
                  <td className="p-3 capitalize">{h.band}</td>
                </>
              ) : (
                <td className="p-3 text-slate-400" colSpan={8}>
                  not live-scored
                </td>
              )}
              <td className="p-3">{h.actualOutcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500">* gated to &ldquo;hold&rdquo; regardless of total, per the (a)+(b) &lt; 15/45 rule.</p>
    </div>
  );
}
