import { createClient } from "@/lib/supabase/server";

type HireRow = {
  id: string;
  name: string;
  is_pm_hire: boolean;
  actual_outcome: string;
  hire_scores: {
    criterion_a: number;
    criterion_b: number;
    criterion_c: number;
    criterion_d: number;
    criterion_e: number;
    criterion_f: number;
    total: number;
    band: string;
    gate_triggered: boolean;
  }[];
};

export default async function CalibrationPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hires")
    .select(
      "id, name, is_pm_hire, actual_outcome, hire_scores(criterion_a, criterion_b, criterion_c, criterion_d, criterion_e, criterion_f, total, band, gate_triggered)"
    )
    .returns<HireRow[]>();

  const hires = (data ?? []).sort((a, b) => (b.hire_scores[0]?.total ?? -1) - (a.hire_scores[0]?.total ?? -1));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Calibration</h1>
        <p className="text-sm text-slate-500">
          The rubric was built from these 8 past hires — only Vikram Nair and Lavanya Iyer were actually
          hired as Product Manager. The other 6 are used only to extract a cross-functional success
          pattern. Scores below marked &ldquo;live-scored&rdquo; were produced by the same Gemini pipeline
          used on real applications, as a check that the scoring implementation matches the documented
          rubric before it&apos;s trusted on the shortlist.
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
          {hires.map((h) => {
            const s = h.hire_scores[0];
            return (
              <tr key={h.id} className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-900">{h.name}</td>
                <td className="p-3">{h.is_pm_hire ? "Yes" : "No"}</td>
                {s ? (
                  <>
                    <td className="p-3">{s.criterion_a}</td>
                    <td className="p-3">{s.criterion_b}</td>
                    <td className="p-3">{s.criterion_c}</td>
                    <td className="p-3">{s.criterion_d}</td>
                    <td className="p-3">{s.criterion_e}</td>
                    <td className="p-3">{s.criterion_f}</td>
                    <td className="p-3 font-semibold">
                      {s.total}
                      {s.gate_triggered ? " *" : ""}
                    </td>
                    <td className="p-3 capitalize">{s.band}</td>
                  </>
                ) : (
                  <td className="p-3 text-slate-400" colSpan={8}>
                    not live-scored
                  </td>
                )}
                <td className="p-3">{h.actual_outcome}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-500">* gated to &ldquo;hold&rdquo; regardless of total, per the (a)+(b) &lt; 15/45 rule.</p>
    </div>
  );
}
