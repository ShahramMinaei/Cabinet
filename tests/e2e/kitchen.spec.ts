import { test, expect } from "@playwright/test";
test("inventory → meal → shopping → purchase → cooking → correction survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /سلام/ })).toBeVisible();
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "شروع دوباره با آشپزخانه خالی" })
    .click();
  const reset = page.getByRole("dialog");
  await reset.getByLabel("برای تأیید، «حذف» را وارد کنید").fill("حذف");
  await reset.getByRole("button", { name: "پاک کردن داده آزمایشی" }).click();
  await expect(page.getByRole("heading", { name: /سلام/ })).toBeVisible();
  await page.goto("/pantry");
  await page
    .getByRole("button", { name: "افزودن ماده غذایی", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ماده غذایی", { exact: true }).selectOption("potato");
  await dialog.getByLabel("مقدار (گرم)").fill("300");
  await dialog.getByRole("button", { name: "ذخیره موجودی" }).click();
  await expect(
    page.getByRole("heading", { name: "سیب‌زمینی", exact: true }),
  ).toBeVisible();
  await page.goto("/recipes");
  await page
    .getByRole("button", { name: "کوکو سیب‌زمینی", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "افزودن به برنامه", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("تعداد نفرات", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: "افزودن به برنامه", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/shopping");
  await page.getByRole("button", { name: "محاسبه از برنامه" }).click();
  await expect(
    page
      .locator(".shopping-row")
      .filter({ has: page.getByText("سیب‌زمینی", { exact: true }) }),
  ).toContainText("۱۵۰");
  const rows = await page.locator(".shopping-row").count();
  for (let i = 0; i < rows; i++) {
    await page.locator(".purchase-check").first().click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "ثبت خرید و افزودن به موجودی" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.locator(".shopping-row")).toHaveCount(0);
  await page.goto("/plan");
  await page.getByRole("button", { name: "ثبت پخت", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("مصرف سیب‌زمینی").fill("400");
  await dialog.getByRole("button", { name: "ثبت پخت و کاهش موجودی" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("پخته شد", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("پخته شد", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "برگشت مصرف" }).click();
  await expect(
    page.getByRole("button", { name: "ثبت پخت", exact: true }),
  ).toBeVisible();
  const quantities = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cabinet:demo:v1")!)
      .pantry.filter(
        (p: { ingredientId: string }) => p.ingredientId === "potato",
      )
      .reduce((sum: number, p: { quantity: number }) => sum + p.quantity, 0),
  );
  expect(quantities).toBe(450);
});
test("catalog revisions preserve already selected meals", async ({ page }) => {
  await page.goto("/");
  await page.goto("/recipes");
  await page.getByRole("button", { name: "پنه آلفردو", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "افزودن به برنامه", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "افزودن به برنامه", exact: true })
    .click();
  await page.goto("/admin");
  await page
    .locator(".admin-row")
    .filter({ hasText: "پنه آلفردو" })
    .getByRole("button", { name: "ویرایش" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("نام غذا", { exact: true })
    .fill("پنه آلفردو ویرایش‌شده");
  await dialog.getByRole("button", { name: "ذخیره نسخه ۲" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/plan");
  await expect(
    page.getByRole("button", { name: "پنه آلفردو", exact: true }),
  ).toBeVisible();
  await page.goto("/recipes");
  await expect(
    page.getByRole("button", { name: "پنه آلفردو ویرایش‌شده", exact: true }),
  ).toBeVisible();
});
test("responsive pages have no horizontal overflow or runtime errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/pantry",
    "/recipes",
    "/shopping",
    "/settings",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
