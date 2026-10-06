import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import packageJson from "@root/package.json";
import { describe, expect, it } from "vitest";

describe("CLI version flag", () => {
  it.each(["-v", "--version"])("prints the package version with %s", (flag) => {
    const childProcess = spawnSync(
      process.versions.bun ? process.execPath : "bun",
      ["run", "src/index.ts", flag],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf-8",
      }
    );

    expect(childProcess.status).toBe(0);
    expect(childProcess.stdout.trim()).toBe(packageJson.version);
    expect(childProcess.stderr).toBe("");
  });
});
