import { readFileSync, writeFileSync } from "node:fs";
const { ingredients, recipes } = JSON.parse(
  readFileSync("src/data/catalog.json", "utf8"),
);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const normalize = (s) =>
  s
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s\u200c\u200dـ]+/g, "")
    .toLowerCase();
let sql = "-- Catalog only: never inserts example household data.\n";
for (const i of ingredients) {
  sql += `insert into public.ingredients(id,name,base_unit,category,allergens,payload) values(${quote(i.id)},${quote(i.name)},${quote(i.unit)},${quote(i.category)},array[${i.allergens.map(quote).join(",")}]::text[],${quote(JSON.stringify(i))}::jsonb) on conflict(id) do nothing;\n`;
  for (const alias of [i.name, ...i.aliases])
    sql += `insert into public.ingredient_aliases values(${quote(normalize(alias))},${quote(i.id)}) on conflict do nothing;\n`;
}
for (const r of recipes) {
  sql += `insert into public.recipes(id) values(${quote(r.id)}) on conflict do nothing;\ninsert into public.recipe_versions values(${quote(r.id)},${r.version},true,${r.published},${quote(JSON.stringify(r))}::jsonb) on conflict(recipe_id,version) do nothing;\n`;
  r.ingredients.forEach((i, index) => {
    sql += `insert into public.recipe_ingredients values(${quote(r.id)},${r.version},${index + 1},${quote(i.ingredientId)},${i.quantity},${quote(i.unit)},${Boolean(i.optional)},${Boolean(i.estimated)}) on conflict do nothing;\n`;
  });
}
writeFileSync("supabase/seed.sql", sql);
