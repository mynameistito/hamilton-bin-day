import { defineConfig } from "oxlint";
import astro from "ultracite/oxlint/astro";

// oxlint-disable-next-line import/no-relative-parent-imports -- Load the shared root config.
import base from "../../oxlint.config.ts";

export default defineConfig({
  extends: [base, astro],
  jsPlugins: base.jsPlugins,
  settings: base.settings,
});
