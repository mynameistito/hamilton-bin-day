import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import packageJson from "@root/package.json";
import { describe, expect, it } from "vitest";

describe("CLI version flag", () => {
  it.each(["-v", "--version"])("prints the package version with %s", (flag) => {
    const bunInstall = process.env.BUN_INSTALL ?? path.join(homedir(), ".bun");
    const bunExecutable = path.join(
      bunInstall,
      "bin",
      `bun${process.platform === "win32" ? ".exe" : ""}`
    );
    const childProcess = spawnSync(
      bunExecutable,
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
