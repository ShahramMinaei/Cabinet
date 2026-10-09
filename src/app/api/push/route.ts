import { z } from "zod";
import {
  authenticatedWorkspace,
  checkOrigin,
  routeError,
} from "@/server/workspace";
import { validPushEndpoint } from "@/server/push";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { client, user, membership } = await authenticatedWorkspace();
    const subscription = z
      .object({
        endpoint: z
          .url()
          .refine(validPushEndpoint, "سرویس اعلان این مرورگر پشتیبانی نمی‌شود"),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({
          p256dh: z.string().min(1).max(500),
          auth: z.string().min(1).max(500),
        }),
      })
      .parse(await request.json());
    const { error } = await client.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        household_id: membership.household_id,
        endpoint: subscription.endpoint,
        payload: subscription,
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error("ثبت دستگاه ممکن نشد");
    return Response.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}
