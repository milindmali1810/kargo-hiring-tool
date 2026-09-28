import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ingestCandidate } from "@/lib/pipeline/ingest";

/**
 * POST /api/candidates — add one new resume. This is the single entry point
 * used both to seed the original 60 applications and for Arjun/the recruiter
 * to add a candidate any time (e.g. right after taking an interview).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const roleField = form.get("role"); // "PM" | "SPM" | "" (let the tagger decide)
  const interviewNotes = form.get("interview_notes");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${crypto.randomUUID()}-${file.name}`;

  const { error: uploadErr } = await supabase.storage.from("resumes").upload(storagePath, buffer, {
    contentType: file.type,
  });
  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const [{ data: pmJDRow }, { data: spmJDRow }] = await Promise.all([
    supabase.from("app_config").select("value").eq("key", "jd_pm").single(),
    supabase.from("app_config").select("value").eq("key", "jd_spm").single(),
  ]);

  try {
    const result = await ingestCandidate({
      supabase,
      file: buffer,
      filename: file.name,
      storagePath,
      filenameRoleTag: roleField === "PM" || roleField === "SPM" ? roleField : null,
      pmJD: pmJDRow?.value ?? "",
      spmJD: spmJDRow?.value ?? "",
      addedVia: "manual_add",
    });

    if (typeof interviewNotes === "string" && interviewNotes.trim()) {
      await supabase
        .from("candidates")
        .update({ interview_notes: interviewNotes })
        .eq("id", result.candidateId);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
