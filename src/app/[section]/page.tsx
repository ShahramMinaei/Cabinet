import { notFound } from "next/navigation";
import { PantryPage } from "@/features/pantry/pantry-page";
import { RecipesPage } from "@/features/recipes/recipes-page";
import { PlanPage } from "@/features/meal-plan/plan-page";
import { ShoppingPage } from "@/features/shopping/shopping-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { AdminPage } from "@/features/admin/admin-page";
const pages = {
  pantry: PantryPage,
  recipes: RecipesPage,
  plan: PlanPage,
  shopping: ShoppingPage,
  settings: SettingsPage,
  admin: AdminPage,
};
export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const Component = pages[section as keyof typeof pages];
  if (!Component) notFound();
  return <Component />;
}
