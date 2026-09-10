import { defineConfig } from "vitest/config";

// Tests run in Node. Widget tests opt into a DOM with a
// `// @vitest-environment happy-dom` comment at the top of the file.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
