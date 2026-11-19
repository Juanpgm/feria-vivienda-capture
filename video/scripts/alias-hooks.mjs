// Node loader hook: resolves the app's "@/..." alias to src/*.ts so we can reuse the real dashboard reducer.
import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = path.join(SRC, spec.slice(2));
    for (const c of [base + ".ts", path.join(base, "index.ts")]) if (existsSync(c)) return next(pathToFileURL(c).href, ctx);
  }
  if (spec.startsWith(".") && ctx.parentURL?.endsWith(".ts") && !path.extname(spec)) {
    const f = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    for (const c of [f + ".ts", path.join(f, "index.ts")]) if (existsSync(c)) return next(pathToFileURL(c).href, ctx);
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith(".json")) return next(url, { ...ctx, importAttributes: { type: "json" } });
  return next(url, ctx);
}
