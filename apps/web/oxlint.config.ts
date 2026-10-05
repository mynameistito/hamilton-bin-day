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
      files: [
        "src/__tests__/pwa.test.ts",
        "src/__tests__/service-worker-notifications.test.ts",
      ],
      // These tests execute fixed, checked-in service-worker source in a VM harness.
      rules: { "sonarjs/code-eval": "off" },
    },
  ],
  settings: base.settings,
});
