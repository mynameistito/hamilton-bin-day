import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import packageJson from "@root/package.json";
import { describe, expect, test } from "vitest";

describe("CLI version flag", () => {
  test.each(["-v", "--version"])(
    "prints the package version with %s",
    (flag) => {
      // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Bun is the workspace runtime.
      const childProcess = spawnSync("bun", ["run", "src/index.ts", flag], {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf-8",
      });

      expect(childProcess.status).toBe(0);
      expect(childProcess.stdout.trim()).toBe(packageJson.version);
      expect(childProcess.stderr).toBe("");
    }
  );
});
