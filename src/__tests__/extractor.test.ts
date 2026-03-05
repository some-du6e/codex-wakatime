import { describe, expect, it } from "vitest";
import { extractFiles } from "../extractor.js";

describe("extractor", () => {
  describe("extractFiles", () => {
    const cwd = "/project";

    describe("write detection", () => {
      it("detects Created as write", () => {
        const message = "Created src/new-file.ts with the implementation.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/new-file.ts", isWrite: true },
        ]);
      });

      it("detects Modified as write", () => {
        const message = "Modified package.json to add the dependency.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/package.json", isWrite: true },
        ]);
      });

      it("detects Updated as write", () => {
        const message = "Updated src/config.ts with new settings.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/config.ts", isWrite: true },
        ]);
      });

      it("detects Wrote as write", () => {
        const message = "Wrote README.md with the documentation.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([{ path: "/project/README.md", isWrite: true }]);
      });

      it("detects Edited as write", () => {
        const message = "Edited src/main.rs to fix the bug.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/main.rs", isWrite: true },
        ]);
      });

      it("detects Deleted as write", () => {
        const message = "Deleted old-file.js as it was unused.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/old-file.js", isWrite: true },
        ]);
      });

      it("detects Create (present tense) as write", () => {
        const message = "Create src/helper.ts";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/helper.ts", isWrite: true },
        ]);
      });

      it("detects Edit (present tense) as write", () => {
        const message = "Edit src/utils.ts";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/utils.ts", isWrite: true },
        ]);
      });
    });

    describe("read detection", () => {
      it("detects Read as read (not write)", () => {
        const message = "Read src/config.ts to understand the settings.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/config.ts", isWrite: false },
        ]);
      });

      it("detects List as read (not write)", () => {
        const message = "List package.json dependencies.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/package.json", isWrite: false },
        ]);
      });
    });

    describe("default to read for non-action patterns", () => {
      it("treats code block paths as read", () => {
        const message = "```typescript:src/index.ts\nconst x = 1;\n```";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/index.ts", isWrite: false },
        ]);
      });

      it("treats backtick paths as read", () => {
        const message = "Check the `src/utils.ts` file.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/utils.ts", isWrite: false },
        ]);
      });

      it("treats quoted paths as read", () => {
        const message = 'The file "src/index.ts" contains the entry point.';
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/index.ts", isWrite: false },
        ]);
      });
    });

    describe("write priority", () => {
      it("marks file as write if both read and write patterns match", () => {
        const message =
          "Read `src/file.ts` first, then Modified src/file.ts to fix the bug.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([
          { path: "/project/src/file.ts", isWrite: true },
        ]);
      });

      it("marks file as write even if write comes before read", () => {
        const message =
          "Created src/new.ts with implementation. Read `src/new.ts` to verify.";
        const files = extractFiles(message, cwd);
        expect(files).toEqual([{ path: "/project/src/new.ts", isWrite: true }]);
      });
    });

    describe("mixed operations", () => {
      it("correctly identifies multiple files with different operations", () => {
        const message = `
I've made the following changes:

1. Read \`src/config.ts\` to understand the current settings
2. Modified \`src/App.tsx\` to import the new component
3. Created \`src/components/Button.tsx\` with the button implementation

The changes have been applied successfully.
`;
        const files = extractFiles(message, cwd);

        const configFile = files.find((f) => f.path.endsWith("config.ts"));
        const appFile = files.find((f) => f.path.endsWith("App.tsx"));
        const buttonFile = files.find((f) => f.path.endsWith("Button.tsx"));

        expect(configFile).toEqual({
          path: "/project/src/config.ts",
          isWrite: false,
        });
        expect(appFile).toEqual({
          path: "/project/src/App.tsx",
          isWrite: true,
        });
        expect(buttonFile).toEqual({
          path: "/project/src/components/Button.tsx",
          isWrite: true,
        });
      });
    });

    describe("edge cases", () => {
      it("returns empty array for empty message", () => {
        expect(extractFiles("", cwd)).toEqual([]);
      });

      it("returns empty array for null-ish message", () => {
        expect(extractFiles(null as unknown as string, cwd)).toEqual([]);
      });
    });
  });
});
