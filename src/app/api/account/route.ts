import {
  authenticatedWorkspace,
  checkOrigin,
  routeError,
} from "@/server/workspace";
import { adminClient } from "@/lib/supabase/server";
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { user, membership, client } = await authenticatedWorkspace();
    if (membership.role !== "owner")
      throw new Error("حذف خانوار فقط برای مالک مجاز است");
    const {
      data: { user: verified },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !verified) throw new Error("UNAUTHORIZED");
    const { error } = await adminClient().auth.admin.deleteUser(user.id);
    if (error) throw new Error("حذف حساب ممکن نشد");
    await client.auth.signOut();
    return Response.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}
