import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const contractRoot = new URL("../../contracts/v1/", import.meta.url);

const requiredFixtureCases = [
  "backend_runner_plan_request",
  "backend_version",
  "backend_capabilities",
  "backend_error_missing_run_input",
  "backend_error_event_missing_stream_input",
  "runner_visible_prefix_plan",
  "runner_visible_setup_plan",
  "runner_metadata_only_plan",
  "runner_full_agent_config",
  "runner_input_items_and_files",
  "runner_budget_blocker",
  "run_browser_bridge_blocker",
  "output_json_parse_success",
  "responses_hidden_instructions_unsupported",
  "responses_unknown_field_unsupported",
  "command_descriptors",
  "describe_runner_run",
  "help_root",
  "doctor_bridge_upload",
  "workflow_ask_success",
  "primitive_bootstrap_blocker",
  "named_plan_two_turn",
  "report_redaction_default",
  "reports_create_redacted",
  "reports_summarize_redacted",
  "stream_blocked",
  "stream_submitted_completed"
];

describe("contract fixtures", () => {
  it("has a manifest that names every fixture", () => {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", contractRoot), "utf8"));
    const fixtureDir = new URL("fixtures/", contractRoot);
    const actual = readdirSync(fixtureDir)
      .filter(name => name.endsWith(".json") || name.endsWith(".ndjson"))
      .sort();

    expect(manifest.fixtures.map((fixture: { file: string }) => fixture.file).sort()).toEqual(actual);
  });

  it("covers the required deterministic parity cases", () => {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", contractRoot), "utf8"));
    const fixtureCases = manifest.fixtures.map((fixture: { case: string }) => fixture.case);
    const cases = new Set(fixtureCases);

    expect(fixtureCases.sort()).toEqual([...cases].sort());
    for (const requiredCase of requiredFixtureCases) {
      expect(cases.has(requiredCase), `Missing fixture case ${requiredCase}`).toBe(true);
    }
  });
});
