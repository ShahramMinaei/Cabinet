// Next Link handles basePath itself; public assets need it explicitly.
export function publicAsset(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
}
