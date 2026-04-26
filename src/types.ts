/**
 * Notification payload from Codex CLI
 * Passed as CLI argument (not stdin) on agent-turn-complete event
 */
export interface CodexNotification {
  type: "agent-turn-complete";
  "thread-id": string;
  "turn-id": string;
  cwd: string;
  client?: string;
  "input-messages": string[];
  "last-assistant-message": string | null;
}

/**
 * Stop hook payload from Codex hooks.
 * Passed on stdin when invoked with --hook.
 */
export interface CodexStopHookInput {
  hook_event_name: "Stop";
  session_id: string;
  turn_id: string;
  cwd: string;
  transcript_path: string | null;
  model: string;
  permission_mode: string;
  stop_hook_active: boolean;
  last_assistant_message: string | null;
}

/**
 * PostToolUse hook payload from Codex hooks.
 * Passed on stdin when invoked with --hook.
 */
export interface CodexPostToolUseHookInput {
  hook_event_name: "PostToolUse";
  session_id: string;
  turn_id: string;
  cwd: string;
  transcript_path: string | null;
  model: string;
  permission_mode: string;
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
}

/**
 * Normalized usage event consumed by the WakaTime sender.
 */
export interface UsageEvent {
  kind: "turn" | "tool";
  cwd: string;
  client?: string;
  assistantMessage?: string;
  files?: ExtractedFile[];
}

/**
 * State persisted to ~/.wakatime/codex.json
 */
export interface State {
  lastHeartbeatAt?: number;
}

/**
 * Parameters for sending a heartbeat to WakaTime
 */
export interface HeartbeatParams {
  entity: string;
  entityType: "file" | "app";
  category?: string;
  projectFolder?: string;
  project?: string;
  lineChanges?: number;
  isWrite?: boolean;
  client?: string;
}

/**
 * CLI state for tracking updates
 */
export interface CliState {
  lastChecked?: number;
  version?: string;
}

/**
 * Extracted file with write detection
 */
export interface ExtractedFile {
  path: string;
  isWrite: boolean;
}
