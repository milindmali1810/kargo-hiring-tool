import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { emailDrafts } from "@/lib/db/schema";

/** PATCH — edit a draft's subject/body before sending. Never touches `status`. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await params;
  const body = await req.json();

  const [existing] = await db.select({ status: emailDrafts.status }).from(emailDrafts).where(eq(emailDrafts.id, draftId));
  if (existing?.status === "sent") {
    return NextResponse.json({ error: "Cannot edit a draft that has already been sent" }, { status: 409 });
  }

  const [updated] = await db
    .update(emailDrafts)
    .set({ subject: body.subject, body: body.body })
    .where(eq(emailDrafts.id, draftId))
    .returning();

  return NextResponse.json(updated);
}
