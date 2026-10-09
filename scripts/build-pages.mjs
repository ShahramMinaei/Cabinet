import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const staging = resolve(root, ".pages-build");
// Only replace the dedicated build directory inside this workspace.
if (relative(root, staging) !== ".pages-build")
  throw new Error("Invalid build path");
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(resolve(root, "src"), resolve(staging, "src"), {
  recursive: true,
  filter: (source) => {
    const path = relative(resolve(root, "src"), source).split(sep).join("/");
    return !["app/api", "app/auth", "server", "proxy.ts"].some(
      (excluded) => path === excluded || path.startsWith(`${excluded}/`),
    );
  },
});
for (const name of [
  "public",
  "package.json",
  "tsconfig.json",
  "postcss.config.mjs",
  "next-env.d.ts",
]) {
  await cp(resolve(root, name), resolve(staging, name), { recursive: true });
}
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] || "Cabinet";
const basePath = repository.endsWith(".github.io") ? "" : `/${repository}`;
await writeFile(
  resolve(staging, "next.config.mjs"),
  `export default ${JSON.stringify({
    output: "export",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
    poweredByHeader: false,
    env: {
      NEXT_PUBLIC_BASE_PATH: basePath,
      NEXT_PUBLIC_STATIC_DEMO: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
    },
    turbopack: { root },
  })};\n`,
);
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/next/dist/bin/next"), "build", staging],
  {
    cwd: staging,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
await writeFile(resolve(staging, "out/.nojekyll"), "");
console.log(`GitHub Pages output: .pages-build/out (basePath: ${basePath})`);
