/**
 * One-time local seed script (not exposed as a route):
 *  1. Loads Rubric.txt + both JDs into app_config.
 *  2. Loads the 8 known hires into `hires`, then runs the REAL Gemini scoring
 *     path against Preetham Rao, Vikram Nair, and Lavanya Iyer and prints a
 *     pass/fail comparison against Rubric.txt's documented calibration table.
 *     This must pass before step 3 runs, so the deployed scoring pipeline is
 *     verified before it touches real applications.
 *  3. Ingests + tags + scores all 60 application CVs in seed-data/applications.
 *
 * Run with: npx tsx scripts/seed.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import mammoth from "mammoth";
import { db } from "@/lib/db/client";
import { appConfig, hires, hireScores } from "@/lib/db/schema";
import { extractText } from "@/lib/pipeline/extractText";
import { normalize } from "@/lib/pipeline/normalize";
import { ingestCandidate } from "@/lib/pipeline/ingest";
import { runScoreForCandidate } from "@/lib/pipeline/runScore";
import { scoreCandidate } from "@/lib/pipeline/score";

const ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT, "seed-data");

async function loadConfig() {
  const rubricText = readFileSync(path.join(SEED_DIR, "Rubric.txt"), "utf-8");
  const pmJdBuf = readFileSync(path.join(SEED_DIR, "jds", "MESA_Kargo_JD_Product Manager.docx"));
  const spmJdBuf = readFileSync(path.join(SEED_DIR, "jds", "MESA_Kargo_JD_Senior Product Manager.docx"));
  const pmJD = (await mammoth.extractRawText({ buffer: pmJdBuf })).value;
  const spmJD = (await mammoth.extractRawText({ buffer: spmJdBuf })).value;

  for (const [key, value] of [
    ["rubric", rubricText],
    ["jd_pm", pmJD],
    ["jd_spm", spmJD],
  ] as const) {
    await db
      .insert(appConfig)
      .values({ key, value })
      .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: new Date() } });
  }
  console.log("[1/3] Rubric + JDs loaded into app_config.");
  return { rubricText, pmJD, spmJD };
}

// Known outcomes from Rubric.txt's calibration table — fixed reference data,
// not re-derived. Filenames match seed-data/hires/.
const HIRES: { file: string; name: string; isPmHire: boolean; actualOutcome: string }[] = [
  { file: "cv_01_rohan_desai.docx", name: "Rohan Desai", isPmHire: false, actualOutcome: "Exceeds" },
  { file: "cv_02_sunita_krishnamurthy.docx", name: "Sunita Krishnamurthy", isPmHire: false, actualOutcome: "Exceeds" },
  { file: "cv_03_vikram_nair.docx", name: "Vikram Nair", isPmHire: true, actualOutcome: "Meets" },
  { file: "cv_04_aditya_shetty.docx", name: "Aditya Shetty", isPmHire: false, actualOutcome: "Exceeds" },
  { file: "cv_05_preetham_rao.docx", name: "Preetham Rao", isPmHire: false, actualOutcome: "Below" },
  { file: "cv_06_meghna_tiwari.docx", name: "Meghna Tiwari", isPmHire: false, actualOutcome: "Exceeds" },
  { file: "cv_07_lavanya_iyer.docx", name: "Lavanya Iyer", isPmHire: true, actualOutcome: "Exceeds" },
  { file: "cv_08_rahul_bose.docx", name: "Rahul Bose", isPmHire: false, actualOutcome: "Meets" },
];

// Rubric.txt's documented calibration table (a-f, total) — the target this
// script's live Gemini run must reproduce for the three calibration hires.
const DOCUMENTED_CALIBRATION: Record<string, { total: number; band: string }> = {
  "Lavanya Iyer": { total: 98, band: "advance" },
  "Vikram Nair": { total: 46, band: "hold" },
  "Preetham Rao": { total: 41, band: "hold" },
};

async function loadHires(rubricText: string, pmJD: string) {
  for (const hire of HIRES) {
    const [existing] = await db.select({ id: hires.id }).from(hires).where(eq(hires.name, hire.name));
    if (existing) continue; // idempotent re-runs

    const buf = readFileSync(path.join(SEED_DIR, "hires", hire.file));
    const rawText = await extractText(buf, hire.file);
    const normalized = await normalize(rawText);

    await db.insert(hires).values({
      sourceFilename: hire.file,
      name: hire.name,
      isPmHire: hire.isPmHire,
      actualOutcome: hire.actualOutcome,
      rawText,
      cleanText: normalized.clean_text,
    });
  }
  console.log(`[2/3] ${HIRES.length} known hires loaded for calibration reference.`);

  // Live calibration check: re-score the 3 named hires through the real
  // pipeline and compare against Rubric.txt's documented numbers.
  console.log("\n--- CALIBRATION CHECK (live Gemini scoring vs Rubric.txt) ---");
  let allPass = true;
  for (const name of ["Lavanya Iyer", "Vikram Nair", "Preetham Rao"]) {
    const [hireRow] = await db.select().from(hires).where(eq(hires.name, name));
    const result = await scoreCandidate({
      cleanText: hireRow.cleanText,
      jdText: pmJD, // all 3 calibration hires are evaluated against the PM posting
      roleLabel: "PM",
      rubricText,
    });

    await db
      .insert(hireScores)
      .values({
        hireId: hireRow.id,
        criterionA: result.a.score,
        criterionB: result.b.score,
        criterionC: result.c.score,
        criterionD: result.d.score,
        criterionE: result.e.score,
        criterionF: result.f.score,
        total: result.total,
        gateTriggered: result.gate_triggered,
        band: result.band,
        rationale: result.rationale,
        evidence: { a: result.a.evidence, b: result.b.evidence, c: result.c.evidence, d: result.d.evidence, e: result.e.evidence, f: result.f.evidence },
        confidenceFlags: { a: result.a.thin_evidence, b: result.b.thin_evidence, c: result.c.thin_evidence, d: result.d.thin_evidence, e: result.e.thin_evidence, f: result.f.thin_evidence },
        probeQuestions: result.probe_questions,
        modelVersion: result.model_version,
      })
      .onConflictDoUpdate({
        target: hireScores.hireId,
        set: {
          criterionA: result.a.score,
          criterionB: result.b.score,
          criterionC: result.c.score,
          criterionD: result.d.score,
          criterionE: result.e.score,
          criterionF: result.f.score,
          total: result.total,
          gateTriggered: result.gate_triggered,
          band: result.band,
          rationale: result.rationale,
          scoredAt: new Date(),
        },
      });

    const target = DOCUMENTED_CALIBRATION[name];
    const withinTolerance = Math.abs(result.total - target.total) <= 10 && result.band === target.band;
    allPass = allPass && withinTolerance;
    console.log(
      `${withinTolerance ? "PASS" : "FAIL"}  ${name}: model=${result.total} (${result.band}${result.gate_triggered ? ", gated" : ""})  target=${target.total} (${target.band})`
    );
  }
  console.log(allPass ? "Calibration PASSED — proceeding to score the 60 applications.\n" : "Calibration FAILED — stopping before scoring the 60. Check score.ts / Rubric.txt.\n");
  return allPass;
}

async function seedApplications() {
  const appsDir = path.join(SEED_DIR, "applications");
  const files = readdirSync(appsDir).filter((f) => f.toLowerCase().endsWith(".pdf") || f.toLowerCase().endsWith(".docx"));

  const [pmJDRow] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, "jd_pm"));
  const [spmJDRow] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, "jd_spm"));

  let count = 0;
  for (const filename of files) {
    const filePath = path.join(appsDir, filename);
    const buffer = readFileSync(filePath);

    const filenameRoleTag: "PM" | "SPM" | null = filename.startsWith("pm_")
      ? "PM"
      : filename.startsWith("spm_")
      ? "SPM"
      : null;

    try {
      const result = await ingestCandidate({
        file: buffer,
        filename,
        filenameRoleTag,
        pmJD: pmJDRow.value,
        spmJD: spmJDRow.value,
        addedVia: "seed",
      });
      count++;
      const dupTag = result.isDuplicate ? `  [DUPLICATE of ${result.duplicateOfId}]` : "";
      console.log(`  (${count}/${files.length}) ${filename} -> role=${result.roleTarget}${dupTag}`);

      if (!result.isDuplicate && result.roleTarget !== "unclear") {
        await runScoreForCandidate(result.candidateId);
      }
    } catch (err) {
      console.error(`  ERROR ingesting ${filename}:`, (err as Error).message);
    }
  }
  console.log(`[3/3] Ingested and scored ${count}/${files.length} application CVs.`);
}

async function main() {
  const { rubricText, pmJD } = await loadConfig();
  const calibrationPassed = await loadHires(rubricText, pmJD);
  if (!calibrationPassed) {
    process.exit(1);
  }
  await seedApplications();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
