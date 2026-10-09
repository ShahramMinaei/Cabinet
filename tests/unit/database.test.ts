import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { emptyWorkspace, applyAction, initialRecipes } from "@/domain/engine";
const db = new PGlite();
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
let householdA: string, householdB: string;
async function asUser(id: string, sql: string, params: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to authenticated;`,
  );
  const migration = readFileSync(
    "supabase/migrations/202610090001_initial.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(migration);
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.query("insert into auth.users values($1),($2)", [a, b]);
  const first = await asUser(
    a,
    "select public.create_household($1::jsonb) as id",
    [JSON.stringify(emptyWorkspace())],
  );
  householdA = (first.rows[0] as { id: string }).id;
  const second = await asUser(
    b,
    "select public.create_household($1::jsonb) as id",
    [JSON.stringify(emptyWorkspace())],
  );
  householdB = (second.rows[0] as { id: string }).id;
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL schema and authorization", () => {
  it("creates an empty real household and isolates other households", async () => {
    const rows = await asUser(
      a,
      "select household_id,state from public.household_workspaces",
    );
    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0] as { household_id: string }).household_id).toBe(
      householdA,
    );
    const other = await asUser(
      a,
      "select * from public.household_workspaces where household_id=$1",
      [householdB],
    );
    expect(other.rows).toHaveLength(0);
  });
  it("rejects direct writes and role escalation", async () => {
    await expect(
      asUser(
        a,
        "update public.household_memberships set role='owner' where user_id=$1",
        [b],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(a, "insert into public.catalog_admins values($1)", [a]),
    ).rejects.toThrow();
  });
  it("blocks direct invocation of privileged mutation functions", async () => {
    await expect(
      asUser(a, "select public.save_workspace($1,$2,0)", [
        householdA,
        JSON.stringify(emptyWorkspace()),
      ]),
    ).rejects.toThrow();
    await expect(
      asUser(a, "select public.queue_push_deliveries()"),
    ).rejects.toThrow();
  });
  it("makes household creation idempotent", async () => {
    const rows = await asUser(
      a,
      "select public.create_household($1::jsonb) as id",
      [JSON.stringify(emptyWorkspace())],
    );
    expect((rows.rows[0] as { id: string }).id).toBe(householdA);
  });
  it("persists atomically and enforces optimistic concurrency", async () => {
    const row = await db.query(
      "select state from public.household_workspaces where household_id=$1",
      [householdA],
    );
    let state = (row.rows[0] as { state: ReturnType<typeof emptyWorkspace> })
      .state;
    state = applyAction(state, {
      type: "pantry.save",
      item: {
        id: crypto.randomUUID(),
        ingredientId: "potato",
        quantity: 300,
        unit: "g",
        location: "cabinet",
        status: "usable",
      },
    });
    await db.exec("set role service_role");
    try {
      await db.query("select public.save_workspace($1,$2,0)", [
        householdA,
        JSON.stringify(state),
      ]);
      await expect(
        db.query("select public.save_workspace($1,$2,0)", [
          householdA,
          JSON.stringify(state),
        ]),
      ).rejects.toThrow("REVISION_CONFLICT");
    } finally {
      await db.exec("reset role");
    }
    const pantry = await asUser(a, "select quantity from public.pantry_items");
    expect(pantry.rows).toHaveLength(1);
    expect(Number((pantry.rows[0] as { quantity: string }).quantity)).toBe(300);
  });
  it("rolls back projections and revisions when a child constraint fails", async () => {
    const row = await db.query(
      "select state from public.household_workspaces where household_id=$1",
      [householdA],
    );
    const state = (row.rows[0] as { state: ReturnType<typeof emptyWorkspace> })
      .state;
    state.pantry[0].quantity = -10;
    await expect(
      db.query("select public.save_workspace($1,$2,1)", [
        householdA,
        JSON.stringify(state),
      ]),
    ).rejects.toThrow();
    const current = await db.query(
      "select revision from public.household_workspaces where household_id=$1",
      [householdA],
    );
    expect((current.rows[0] as { revision: number }).revision).toBe(1);
  });
  it("hides unpublished recipe drafts from ordinary accounts", async () => {
    const rows = await asUser(
      a,
      "select recipe_id from public.recipe_versions where is_current",
    );
    expect(rows.rows).toHaveLength(7);
  });
  it("denies cross-household push subscriptions", async () => {
    await expect(
      asUser(a, "insert into public.push_subscriptions values($1,$2,$3,$4)", [
        a,
        householdB,
        "https://fcm.googleapis.com/test",
        "{}",
      ]),
    ).rejects.toThrow();
  });
  it("publishes a new catalog version without changing an existing meal", async () => {
    const row = await db.query(
      "select state,revision from public.household_workspaces where household_id=$1",
      [householdA],
    );
    const current = row.rows[0] as {
      state: ReturnType<typeof emptyWorkspace>;
      revision: number;
    };
    const recipe = initialRecipes.find((r) => r.id === "alfredo")!;
    const state = applyAction(current.state, {
      type: "meal.add",
      recipeId: recipe.id,
      date: current.state.household.nextShoppingDate,
      slot: "dinner",
      servings: 2,
    });
    await db.query("select public.save_workspace($1,$2,$3)", [
      householdA,
      JSON.stringify(state),
      current.revision,
    ]);
    await db.query("insert into public.catalog_admins values($1)", [a]);
    await db.exec("set role service_role");
    try {
      await db.query("select public.publish_recipe($1,1,$2)", [
        JSON.stringify({ ...recipe, version: 2, name: "New Alfredo" }),
        a,
      ]);
    } finally {
      await db.exec("reset role");
    }
    const meals = await asUser(
      a,
      "select recipe_version from public.meal_plans",
    );
    expect((meals.rows[0] as { recipe_version: number }).recipe_version).toBe(
      1,
    );
    const versions = await asUser(
      a,
      "select version,is_current from public.recipe_versions where recipe_id='alfredo' order by version",
    );
    expect(versions.rows).toEqual([
      { version: 1, is_current: false },
      { version: 2, is_current: true },
    ]);
  });
  it("queues each push delivery once and prevents simultaneous duplicate claims", async () => {
    const row = await db.query(
      "select state,revision from public.household_workspaces where household_id=$1",
      [householdA],
    );
    const current = row.rows[0] as {
      state: ReturnType<typeof emptyWorkspace>;
      revision: number;
    };
    current.state.household.reserves = { milk: 500 };
    current.state.reminders = [
      {
        id: "test-reminder",
        time: "00:00",
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        slot: "all",
      },
    ];
    const state = applyAction(current.state, { type: "reminders.check" });
    await db.query("select public.save_workspace($1,$2,$3)", [
      householdA,
      JSON.stringify(state),
      current.revision,
    ]);
    const endpoint = "https://fcm.googleapis.com/fcm/send/test";
    await asUser(
      a,
      "insert into public.push_subscriptions values($1,$2,$3,$4)",
      [
        a,
        householdA,
        endpoint,
        JSON.stringify({ endpoint, keys: { p256dh: "fake", auth: "fake" } }),
      ],
    );
    await db.exec("set role service_role");
    try {
      await db.query("select public.queue_push_deliveries()");
      await db.query("select public.queue_push_deliveries()");
      const first = await db.query(
        "select * from public.claim_push_deliveries(50)",
      );
      const second = await db.query(
        "select * from public.claim_push_deliveries(50)",
      );
      expect(first.rows).toHaveLength(1);
      expect(second.rows).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
  it("protects cross-household child relationships", async () => {
    const other = await db.query(
      "select id from public.pantry_items where household_id=$1",
      [householdA],
    );
    const id = (other.rows[0] as { id: string }).id;
    await expect(
      db.query(
        "insert into public.pantry_transactions(household_id,id,payload) values($1,$2,$3)",
        [
          householdB,
          crypto.randomUUID(),
          JSON.stringify({
            pantryItemId: id,
            ingredientId: "potato",
            delta: 1,
          }),
        ],
      ),
    ).rejects.toThrow();
  });
  it("deletes all owned household data when deleting its user", async () => {
    await db.query("delete from auth.users where id=$1", [b]);
    const rows = await db.query(
      "select * from public.household_workspaces where household_id=$1",
      [householdB],
    );
    expect(rows.rows).toHaveLength(0);
  });
});
