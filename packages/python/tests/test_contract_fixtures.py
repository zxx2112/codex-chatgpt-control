import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "node" / "contracts" / "v1"
REQUIRED = {
    "run-basic-success.json",
    "run-two-turn-success.json",
    "run-file-attach-success.json",
    "run-browser-bridge-blocker.json",
    "run-upload-permission-blocker.json",
    "run-selector-drift-blocker.json",
    "run-timeout-partial.json",
    "run-report-redacted.json",
    "responses-basic-success.json",
    "responses-unsupported-temperature.json",
    "responses-unsupported-previous-response-id.json",
    "stream-basic.ndjson",
    "stream-blocked.ndjson",
}


class ContractFixtureInventoryTests(unittest.TestCase):
    def test_manifest_contains_required_fixture_matrix(self) -> None:
        manifest = json.loads((CONTRACT / "manifest.json").read_text(encoding="utf-8"))
        listed = {fixture["file"] for fixture in manifest["fixtures"]}
        self.assertEqual(REQUIRED - listed, set())


if __name__ == "__main__":
    unittest.main()
