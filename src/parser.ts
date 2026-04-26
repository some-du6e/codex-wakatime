import { extractApplyPatchFiles } from "./extractor.js";
import type { CodexNotification, UsageEvent } from "./types.js";

function parseJsonObject(input: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function applyPatchCommand(toolInput: unknown): string | undefined {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return undefined;
  }
  return stringValue((toolInput as Record<string, unknown>).command);
}

export function parseLegacyNotification(
  jsonArg: string | undefined,
): UsageEvent | undefined {
  if (!jsonArg || jsonArg.startsWith("-")) {
    return undefined;
  }

  const notification = parseJsonObject(jsonArg) as
    | (Partial<CodexNotification> & Record<string, unknown>)
    | undefined;
  if (!notification || notification.type !== "agent-turn-complete") {
    return undefined;
  }

  const cwd = stringValue(notification.cwd);
  if (!cwd) {
    return undefined;
  }

  return {
    kind: "turn",
    cwd,
    client: stringValue(notification.client),
    assistantMessage: nullableStringValue(
      notification["last-assistant-message"],
    ),
  };
}

export function parseHookInput(input: string): UsageEvent | undefined {
  const payload = parseJsonObject(input);
  if (!payload) {
    return undefined;
  }

  const cwd = stringValue(payload.cwd);
  if (!cwd) {
    return undefined;
  }

  if (payload.hook_event_name === "Stop") {
    return {
      kind: "turn",
      cwd,
      assistantMessage: nullableStringValue(payload.last_assistant_message),
    };
  }

  if (
    payload.hook_event_name === "PostToolUse" &&
    payload.tool_name === "apply_patch"
  ) {
    const command = applyPatchCommand(payload.tool_input);
    if (!command) {
      return undefined;
    }

    const files = extractApplyPatchFiles(command, cwd);
    if (files.length === 0) {
      return undefined;
    }

    return {
      kind: "tool",
      cwd,
      files,
    };
  }

  return undefined;
}
