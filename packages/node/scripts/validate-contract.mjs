import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "contracts", "v1");
const manifest = readJson(join(root, "manifest.json"));
const manifestSchema = readJson(join(root, "schemas", "manifest.schema.json"));

const ajv = new Ajv2020({ allErrors: true, strict: true });

validateOrThrow(ajv.compile(manifestSchema), manifest, "manifest.json");

const schemas = Object.fromEntries(
  Object.entries(manifest.schemas).map(([name, path]) => [name, readJson(join(root, path))])
);

for (const [name, schema] of Object.entries(schemas)) {
  ajv.compile(schema);
  if (typeof schema.$id !== "string" || schema.$id.length === 0) {
    throw new Error(`Schema "${name}" must have a non-empty $id.`);
  }
}

const fixtureNames = readdirSync(join(root, "fixtures"))
  .filter(name => name.endsWith(".json") || name.endsWith(".ndjson"))
  .sort();
const manifestNames = manifest.fixtures.map(fixture => fixture.file).sort();

if (JSON.stringify(fixtureNames) !== JSON.stringify(manifestNames)) {
  throw new Error(`Manifest fixture list does not match directory. manifest=${manifestNames.join(",")} actual=${fixtureNames.join(",")}`);
}

for (const fixture of manifest.fixtures) {
  const schema = schemas[fixture.schema];
  if (schema === undefined) {
    throw new Error(`Unknown fixture schema "${fixture.schema}" for ${fixture.file}.`);
  }
  const validate = ajv.compile(schema);
  const path = join(root, "fixtures", fixture.file);

  if (fixture.file.endsWith(".ndjson")) {
    const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      throw new Error(`${fixture.file} must contain at least one event.`);
    }
    for (const [index, line] of lines.entries()) {
      validateOrThrow(validate, JSON.parse(line), `${fixture.file}:${index + 1}`);
    }
    continue;
  }

  const payload = readJson(path);
  const value = fixture.schema === "runResult"
    ? payload.result
    : fixture.schema === "response"
      ? payload.response
      : fixture.schema === "commandResult"
        ? payload.result
      : payload;
  validateOrThrow(validate, value, fixture.file);
}

console.log(`Validated ${manifest.fixtures.length} contract fixtures.`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateOrThrow(validate, value, label) {
  if (validate(value)) return;
  throw new Error(`${label} failed schema validation: ${ajv.errorsText(validate.errors, { separator: "\n" })}`);
}
