import { defineConfig } from "oxlint";
import { selectJsPlugins } from "ultracite/oxlint/js-plugins";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";

import base from "../../oxlint.config.ts";

const jsPlugins = selectJsPlugins(["react-doctor"]);

export default defineConfig({
  extends: [base, tanstack, tanstackJsPlugins, jsPlugins],
  jsPlugins: [...(base.jsPlugins ?? []), ...jsPlugins.jsPlugins],
  overrides: [
    {
      files: ["src/**"],
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
  settings: base.settings,
});
