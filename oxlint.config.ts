import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import vitest from "ultracite/oxlint/vitest";

const jsPlugins = selectJsPlugins(["github", "jsdoc-js", "sonarjs", "tsdoc"]);

export default defineConfig({
  extends: [core, vitest, react, shadcn, antiSlop, jsPlugins],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: [...jsPlugins.jsPlugins, ...shadcn.jsPlugins],
  overrides: [
    {
      files: ["src/**", "packages/cli/src/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                message: "Use the @/* alias for imports between src modules.",
                regex: "^\\.\\./",
              },
            ],
          },
        ],
      },
    },
  ],
  settings: jsPluginSettings,
});
