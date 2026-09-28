import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates, appConfig } from "@/lib/db/schema";
import { ingestCandidate } from "@/lib/pipeline/ingest";

/**
 * POST /api/candidates — add one new resume. This is the single entry point
 * used both to seed the original 60 applications and for Arjun/the recruiter
 * to add a candidate any time (e.g. right after taking an interview).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const roleField = form.get("role"); // "PM" | "SPM" | "" (let the tagger decide)
  const interviewNotes = form.get("interview_notes");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const [pmJDRow] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, "jd_pm"));
  const [spmJDRow] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, "jd_spm"));

  try {
    const result = await ingestCandidate({
      file: buffer,
      filename: file.name,
      filenameRoleTag: roleField === "PM" || roleField === "SPM" ? roleField : null,
      pmJD: pmJDRow?.value ?? "",
      spmJD: spmJDRow?.value ?? "",
      addedVia: "manual_add",
    });

    if (typeof interviewNotes === "string" && interviewNotes.trim()) {
      await db.update(candidates).set({ interviewNotes }).where(eq(candidates.id, result.candidateId));
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
