// Stamped into every index file. `npm version` rewrites this through scripts/sync-version.mjs, and a test
// keeps it equal to package.json.
export const VERSION = "0.1.1";
/** Bump when SerializedIndex changes shape. 2 (M11): a `path` search field, and `property` units in sections. */
export const FORMAT_VERSION = 2;
