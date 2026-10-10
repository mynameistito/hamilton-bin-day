import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  platform: "node",
});
