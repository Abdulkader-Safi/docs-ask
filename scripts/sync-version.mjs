// Keeps src/core/version.ts equal to package.json. npm runs this on `npm version`, between the bump and
// the commit it makes, so the two never drift. A test asserts they match.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const file = new URL("src/core/version.ts", root);
const before = readFileSync(file, "utf8");
const after = before.replace(/(export const VERSION = ")[^"]*(")/, `$1${version}$2`);
if (after === before) console.log(`version.ts already at ${version}`);
else {
  writeFileSync(file, after);
  console.log(`version.ts -> ${version}`);
}
