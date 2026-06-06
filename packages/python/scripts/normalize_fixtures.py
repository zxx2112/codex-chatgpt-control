from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def normalize(value: Any) -> Any:
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {
            key: normalize(value[key])
            for key in sorted(value)
        }
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(normalize(value), ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def load_fixture_value(contract_root: Path, fixture: dict[str, str]) -> Any:
    path = contract_root / "fixtures" / fixture["file"]
    if fixture["file"].endswith(".ndjson"):
        return [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").strip().splitlines()
            if line
        ]
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize ChatGPT browser-control contract fixtures.")
    parser.add_argument("contract_root", type=Path)
    args = parser.parse_args()

    manifest = json.loads((args.contract_root / "manifest.json").read_text(encoding="utf-8"))
    normalized = {
        fixture["file"]: normalize(load_fixture_value(args.contract_root, fixture))
        for fixture in manifest["fixtures"]
    }
    print(json.dumps(normalized, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
