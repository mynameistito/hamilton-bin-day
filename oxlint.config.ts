import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import vitest from "ultracite/oxlint/vitest";

const jsPlugins = selectJsPlugins(["github", "sonarjs"]);

export default defineConfig({
  extends: [antiSlop, core, jsPlugins, vitest],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: jsPlugins.jsPlugins,
  rules: { "import/no-relative-parent-imports": "error" },
  settings: jsPluginSettings,
});
