import {
  authenticatedWorkspace,
  catalog,
  persistWorkspace,
  routeError,
  checkOrigin,
} from "@/server/workspace";
import { applyAction } from "@/domain/engine";
import { actionSchema } from "@/domain/validation";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const context = await authenticatedWorkspace();
    const [recipes, role, notices] = await Promise.all([
      catalog(context.client),
      context.client
        .from("catalog_admins")
        .select("user_id")
        .eq("user_id", context.user.id)
        .maybeSingle(),
      context.client
        .from("notifications")
        .select("payload")
        .eq("household_id", context.membership.household_id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const known = new Set(context.state.notices.map((n) => n.id));
    return Response.json(
      {
        state: {
          ...context.state,
          notices: [
            ...context.state.notices,
            ...(notices.data || [])
              .map((n) => n.payload)
              .filter((n) => !known.has(n.id)),
          ],
        },
        recipes,
        isAdmin: Boolean(role.data),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const raw = await request.text();
    if (raw.length > 200000) throw new Error("درخواست بیش از حد بزرگ است");
    const body = z
      .object({
        action: actionSchema,
        revision: z.number().int().min(0),
        operationId: z.uuid(),
      })
      .parse(JSON.parse(raw));
    const ctx = await authenticatedWorkspace();
    if (ctx.membership.role === "viewer")
      throw new Error("دسترسی ویرایش ندارید");
    if (ctx.state.operationIds.includes(body.operationId))
      return Response.json({ state: ctx.state });
    if (ctx.state.revision !== body.revision) throw new Error("CONFLICT");
    const recipes = await catalog(ctx.client);
    const next = applyAction(ctx.state, body.action, recipes);
    next.operationIds = [...next.operationIds, body.operationId].slice(-200);
    const state = await persistWorkspace(
      ctx.membership.household_id,
      next,
      ctx.state.revision,
    );
    return Response.json({ state });
  } catch (error) {
    return routeError(error);
  }
}
