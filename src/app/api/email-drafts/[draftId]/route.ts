import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH — edit a draft's subject/body before sending. Never touches `status`. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await params;
  const body = await req.json();

  const { data: existing } = await supabase.from("email_drafts").select("status").eq("id", draftId).single();
  if (existing?.status === "sent") {
    return NextResponse.json({ error: "Cannot edit a draft that has already been sent" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("email_drafts")
    .update({ subject: body.subject, body: body.body })
    .eq("id", draftId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
