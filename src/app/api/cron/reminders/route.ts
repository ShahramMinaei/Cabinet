import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { adminClient } from "@/lib/supabase/server";
import { applyAction } from "@/domain/engine";
import { workspaceSchema } from "@/domain/validation";
import { validPushEndpoint } from "@/server/push";
import type { Workspace } from "@/domain/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET,
    header = request.headers.get("authorization") || "";
  if (!secret || secret.length < 32)
    return Response.json(
      { error: "Scheduler not configured" },
      { status: 503 },
    );
  const expected = Buffer.from("Bearer " + secret),
    actual = Buffer.from(header);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = adminClient(),
      now = new Date();
    let generated = 0,
      scanned = 0,
      offset = 0;
    for (;;) {
      const { data: rows, error } = await client
        .from("household_workspaces")
        .select("household_id,state,revision")
        .order("household_id")
        .range(offset, offset + 99);
      if (error) throw error;
      if (!rows?.length) break;
      for (const row of rows) {
        scanned++;
        const state = workspaceSchema.parse({
          ...row.state,
          revision: row.revision,
        }) as Workspace;
        const next = applyAction(state, { type: "reminders.check" }, [], now);
        if (next.notices.length === state.notices.length) continue;
        const saved = await client.rpc("save_workspace", {
          p_household_id: row.household_id,
          p_state: next,
          p_expected: row.revision,
        });
        if (saved.error) {
          if (saved.error.message.includes("REVISION_CONFLICT")) continue;
          throw saved.error;
        }
        generated += next.notices.length - state.notices.length;
      }
      offset += rows.length;
      if (rows.length < 100) break;
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey = process.env.VAPID_PRIVATE_KEY;
    let sent = 0,
      failed = 0;
    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        publicKey,
        privateKey,
      );
      const queued = await client.rpc("queue_push_deliveries");
      if (queued.error) throw queued.error;
      const claimed = await client.rpc("claim_push_deliveries", {
        p_limit: 50,
      });
      if (claimed.error) throw claimed.error;
      await Promise.all(
        (claimed.data || []).map(
          async (job: {
            delivery_id: number;
            notification_id: string;
            endpoint: string;
            subscription: webpush.PushSubscription;
            notification: { title: string; body: string; key: string };
          }) => {
            try {
              if (!validPushEndpoint(job.endpoint))
                throw new Error("Untrusted push endpoint");
              await webpush.sendNotification(
                job.subscription,
                JSON.stringify(job.notification),
                { TTL: 3600, timeout: 10000 },
              );
              await client
                .from("notification_deliveries")
                .update({
                  status: "sent",
                  last_error: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", job.delivery_id);
              sent++;
            } catch (e) {
              const status = (e as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410)
                await client
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", job.endpoint);
              await client
                .from("notification_deliveries")
                .update({
                  status: "failed",
                  last_error: status ? String(status) : "delivery failed",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", job.delivery_id);
              failed++;
            }
          },
        ),
      );
    }
    return Response.json({
      scanned,
      generated,
      sent,
      failed,
      pushConfigured: Boolean(publicKey && privateKey),
    });
  } catch {
    return Response.json(
      {
        error:
          "Reminder processing failed; check server logs and database setup",
      },
      { status: 500 },
    );
  }
}
