import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function readFixture(name: string): Promise<string> {
  if (name.includes("..") || name.startsWith("/")) {
    throw new Error(`Unsafe fixture name: ${name}`);
  }

  return readFile(resolve("tests/fixtures", name), "utf8");
}
