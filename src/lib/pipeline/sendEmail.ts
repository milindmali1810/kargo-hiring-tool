import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailDrafts } from "@/lib/db/schema";

/**
 * The one place Resend's send API is actually called from. Sends exactly the
 * given draft to the given address, then marks it sent. Both the "review the
 * draft, then send" flow (candidate detail page) and the "one-click from the
 * dashboard" flow call this — there is no other call site, and neither call
 * site loops over more than one candidate.
 */
export async function sendEmailDraft(draft: { id: string; subject: string; body: string }, toEmail: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error: sendErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: toEmail,
    subject: draft.subject,
    text: draft.body,
  });
  if (sendErr) throw new Error(sendErr.message);

  await db
    .update(emailDrafts)
    .set({ status: "sent", sentAt: new Date(), resendMessageId: sent?.id ?? null })
    .where(eq(emailDrafts.id, draft.id));

  return { resendMessageId: sent?.id ?? null };
}
