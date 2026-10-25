import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...next,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
