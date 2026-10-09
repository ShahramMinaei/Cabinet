import { serverClient, adminClient } from "@/lib/supabase/server";
import { emptyWorkspace } from "@/domain/engine";
import { workspaceSchema } from "@/domain/validation";
import type { Workspace, Recipe } from "@/domain/types";
import { ZodError } from "zod";
export async function authenticatedWorkspace() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  let { data: membership, error: memberError } = await client
    .from("household_memberships")
    .select("household_id,role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (memberError)
    throw new Error(
      "دسترسی به خانوار ممکن نشد؛ مهاجرت پایگاه داده را بررسی کنید",
    );
  if (!membership) {
    const { error } = await client.rpc("create_household", {
      p_initial: emptyWorkspace(),
    });
    if (error) throw new Error(error.message);
    const found = await client
      .from("household_memberships")
      .select("household_id,role")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    membership = found.data;
  }
  if (!membership) throw new Error("خانوار ایجاد نشد");
  const { data: row, error: loadError } = await client
    .from("household_workspaces")
    .select("state,revision")
    .eq("household_id", membership.household_id)
    .single();
  if (loadError || !row) throw new Error("بازیابی اطلاعات خانوار ممکن نشد");
  return {
    client,
    user,
    membership,
    state: workspaceSchema.parse({
      ...row.state,
      revision: row.revision,
    }) as Workspace,
  };
}
export async function catalog(
  client: Awaited<ReturnType<typeof serverClient>>,
) {
  const { data, error } = await client
    .from("recipe_versions")
    .select("payload")
    .eq("is_current", true);
  if (error) throw new Error("دریافت کاتالوگ ممکن نشد");
  return (data || []).map((r) => r.payload as Recipe);
}
export async function persistWorkspace(
  householdId: string,
  state: Workspace,
  expected: number,
) {
  const { error } = await adminClient().rpc("save_workspace", {
    p_household_id: householdId,
    p_state: state,
    p_expected: expected,
  });
  if (error) {
    if (error.message.includes("REVISION_CONFLICT"))
      throw new Error("CONFLICT");
    throw new Error("ذخیره اطلاعات ممکن نشد: " + error.message);
  }
  return { ...state, revision: expected + 1 };
}
export function routeError(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "اطلاعات واردشده معتبر نیست؛ مقدارها و تاریخ‌ها را بررسی کنید.",
      },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : "خطای نامشخص";
  return Response.json(
    {
      error:
        message === "UNAUTHORIZED"
          ? "ابتدا وارد حساب شوید"
          : message === "CONFLICT"
            ? "اطلاعات در دستگاه دیگری تغییر کرده است؛ صفحه را تازه کنید"
            : message,
    },
    {
      status:
        message === "UNAUTHORIZED" ? 401 : message === "CONFLICT" ? 409 : 400,
    },
  );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new Error("مبدأ درخواست معتبر نیست");
}
