import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterScenarios, requiredFailures, writeReport } from "../../src/scripts/live-smoke/harness.js";
import type { LiveSmokeScenario } from "../../src/scripts/live-smoke/types.js";
import type { LiveSmokeScenarioResult } from "../../src/scripts/live-smoke/types.js";

function result(name: string, status: LiveSmokeScenarioResult["status"], required: boolean): LiveSmokeScenarioResult {
  return {
    name,
    status,
    required,
    startedAt: "2026-06-05T00:00:00.000Z",
    endedAt: "2026-06-05T00:00:00.000Z",
    durationMs: 0
  };
}

describe("live smoke harness", () => {
  it("reports only required non-passing scenarios as required failures", () => {
    expect(requiredFailures([
      result("pass", "pass", true),
      result("skip-optional", "skip", false),
      result("fail-required", "fail", true),
      result("skip-required", "skip", true)
    ]).map(item => item.name)).toEqual(["fail-required", "skip-required"]);
  });

  it("filters scenarios by comma-separated name", () => {
    const scenarios = [
      scenario("new-ask-read"),
      scenario("copy-latest"),
      scenario("attach-one-file")
    ];

    expect(filterScenarios(scenarios, "copy-latest, attach-one-file").map(item => item.name)).toEqual([
      "copy-latest",
      "attach-one-file"
    ]);
  });

  it("redacts command content in persisted live-smoke reports", async () => {
    const dir = await mkdtemp(join(tmpdir(), "chatgpt-live-report-"));
    const reportPath = await writeReport(dir, [{
      ...result("copy-markdown", "pass", true),
      command: {
        ok: true,
        status: "ok",
        data: {
          text: "private@example.com",
          markdown: "## Secret",
          html: "<p>secret</p>"
        },
        warnings: ["private@example.com"],
        context: { timestamp: "2026-06-05T00:00:00.000Z", title: "private@example.com" }
      }
    }]);

    const body = await readFile(reportPath, "utf8");
    expect(body).toContain("\"name\": \"copy-markdown\"");
    expect(body).toContain("\"status\": \"pass\"");
    expect(body).toContain("[redacted:");
    expect(body).not.toContain("private@example.com");
    expect(body).not.toContain("## Secret");
    expect(body).not.toContain("<p>secret</p>");
  });
});

function scenario(name: string): LiveSmokeScenario {
  return {
    name,
    required: true,
    enabled: () => true,
    run: async () => result(name, "pass", true)
  };
}
