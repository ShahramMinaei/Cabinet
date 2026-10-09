import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(".pages-build/out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/Cabinet/")) throw new Error("Invalid base path");
    let file = resolve(root, path.slice(9));
    if (relative(root, file).startsWith(".."))
      throw new Error("Invalid file path");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((done) => server.listen(3021, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("http://127.0.0.1:3021/Cabinet/");
  await page.locator(".app-shell").waitFor();
  for (const section of [
    "pantry",
    "recipes",
    "plan",
    "shopping",
    "settings",
    "admin",
  ]) {
    await page.locator(`.sidebar a[href="/Cabinet/${section}/"]`).click();
    await page.waitForURL(`**/Cabinet/${section}/`);
    await page.reload();
    await page.locator(".app-shell").waitFor();
  }
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("cabinet:demo:v1"));
    state.household.name = "Pages persistence test";
    localStorage.setItem("cabinet:demo:v1", JSON.stringify(state));
  });
  await page.reload();
  await page.getByText("Pages persistence test", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3021/Cabinet/");
  await page.locator(".app-shell").waitFor();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile overflow");
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    "PASS: 7 static pages, navigation, reload, local storage, assets and mobile layout.",
  );
} finally {
  await browser?.close();
  server.close();
}
