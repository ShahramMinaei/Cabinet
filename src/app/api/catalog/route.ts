import { z } from "zod";
import { serverClient, adminClient } from "@/lib/supabase/server";
import { recipeSchema } from "@/domain/validation";
import { ingredientMap, baseQuantity } from "@/domain/engine";
import { checkOrigin, routeError } from "@/server/workspace";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("UNAUTHORIZED");
    const { data: role } = await client
      .from("catalog_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!role) throw new Error("فقط مدیر کاتالوگ مجاز به انتشار غذاست");
    const body = z
      .object({ recipe: recipeSchema, expected: z.number().int().min(0) })
      .parse(await request.json());
    for (const i of body.recipe.ingredients) {
      if (!ingredientMap.has(i.ingredientId)) throw new Error("ماده ناشناخته");
      baseQuantity(i.ingredientId, i.quantity, i.unit);
    }
    const { error } = await adminClient().rpc("publish_recipe", {
      p_recipe: body.recipe,
      p_expected: body.expected,
      p_actor: user.id,
    });
    if (error)
      throw new Error(
        error.message.includes("REVISION_CONFLICT")
          ? "CONFLICT"
          : error.message,
      );
    return Response.json({ recipe: body.recipe });
  } catch (e) {
    return routeError(e);
  }
}
