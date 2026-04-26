import { describe, expect, it } from "vitest";
import { parseHookInput, parseLegacyNotification } from "../parser.js";

describe("parser", () => {
  describe("parseLegacyNotification", () => {
    it("normalizes legacy notify argv payloads", () => {
      const event = parseLegacyNotification(
        JSON.stringify({
          type: "agent-turn-complete",
          "thread-id": "thread-1",
          "turn-id": "turn-1",
          cwd: "/project",
          client: "codex-tui",
          "input-messages": ["change it"],
          "last-assistant-message": "Updated src/index.ts",
        }),
      );

      expect(event).toEqual({
        kind: "turn",
        cwd: "/project",
        client: "codex-tui",
        assistantMessage: "Updated src/index.ts",
      });
    });

    it("ignores flags and invalid payloads", () => {
      expect(parseLegacyNotification("--install")).toBeUndefined();
      expect(parseLegacyNotification("{")).toBeUndefined();
    });
  });

  describe("parseHookInput", () => {
    it("normalizes Stop hook stdin payloads", () => {
      const event = parseHookInput(
        JSON.stringify({
          hook_event_name: "Stop",
          session_id: "thread-1",
          turn_id: "turn-1",
          cwd: "/project",
          transcript_path: null,
          model: "gpt-5",
          permission_mode: "default",
          stop_hook_active: false,
          last_assistant_message: "Modified README.md",
        }),
      );

      expect(event).toEqual({
        kind: "turn",
        cwd: "/project",
        assistantMessage: "Modified README.md",
      });
    });

    it("normalizes apply_patch PostToolUse hook stdin payloads", () => {
      const event = parseHookInput(
        JSON.stringify({
          hook_event_name: "PostToolUse",
          session_id: "thread-1",
          turn_id: "turn-1",
          cwd: "/project",
          transcript_path: null,
          model: "gpt-5",
          permission_mode: "default",
          tool_name: "apply_patch",
          tool_use_id: "call-1",
          tool_input: {
            command:
              "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-old\n+new\n*** End Patch\n",
          },
          tool_response: "Success",
        }),
      );

      expect(event).toEqual({
        kind: "tool",
        cwd: "/project",
        files: [{ path: "/project/src/index.ts", isWrite: true }],
      });
    });

    it("ignores unsupported PostToolUse tools", () => {
      const event = parseHookInput(
        JSON.stringify({
          hook_event_name: "PostToolUse",
          cwd: "/project",
          tool_name: "Bash",
          tool_input: { command: "touch src/index.ts" },
        }),
      );

      expect(event).toBeUndefined();
    });

    it("ignores apply_patch PostToolUse payloads without parseable files", () => {
      const event = parseHookInput(
        JSON.stringify({
          hook_event_name: "PostToolUse",
          cwd: "/project",
          tool_name: "apply_patch",
          tool_input: { command: "not a patch" },
        }),
      );

      expect(event).toBeUndefined();
    });
  });
});
