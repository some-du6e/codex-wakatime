import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import TOML from "@iarna/toml";

const CODEX_CONFIG_PATH = path.join(os.homedir(), ".codex", "config.toml");
const LEGACY_NOTIFY_COMMAND = "codex-wakatime";
const HOOK_COMMAND = "codex-wakatime --hook";
const HOOK_TIMEOUT_SECONDS = 60;
const CODEX_HOOKS_FEATURE = "codex_hooks";
const STOP_EVENT = "Stop";
const POST_TOOL_USE_EVENT = "PostToolUse";

type TomlRecord = Record<string, unknown>;

interface HookSpec {
  eventName: typeof STOP_EVENT | typeof POST_TOOL_USE_EVENT;
  matcher?: string;
}

const HOOK_SPECS: HookSpec[] = [
  { eventName: STOP_EVENT },
  { eventName: POST_TOOL_USE_EVENT, matcher: "apply_patch" },
];

function isRecord(value: unknown): value is TomlRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeNotifyCommand(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const entries = value.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
    return entries.length > 0 ? entries : undefined;
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return undefined;
}

function isOwnedLegacyNotify(value: unknown): boolean {
  const command = normalizeNotifyCommand(value);
  return command?.length === 1 && command[0] === LEGACY_NOTIFY_COMMAND;
}

function hooksConfig(config: TomlRecord): TomlRecord {
  const existing = config.hooks;
  if (isRecord(existing)) {
    return existing;
  }

  const hooks: TomlRecord = {};
  config.hooks = hooks;
  return hooks;
}

function featuresConfig(config: TomlRecord): TomlRecord {
  const existing = config.features;
  if (isRecord(existing)) {
    return existing;
  }

  const features: TomlRecord = {};
  config.features = features;
  return features;
}

function ensureCodexHooksFeature(config: TomlRecord): boolean {
  const features = featuresConfig(config);
  if (features[CODEX_HOOKS_FEATURE] === true) {
    return false;
  }

  features[CODEX_HOOKS_FEATURE] = true;
  return true;
}

function matcherMatches(
  group: TomlRecord,
  matcher: string | undefined,
): boolean {
  if (matcher === undefined) {
    return group.matcher === undefined || group.matcher === null;
  }
  return group.matcher === matcher;
}

function hookEntryMatches(entry: unknown): entry is TomlRecord {
  return isRecord(entry) && entry.command === HOOK_COMMAND;
}

function ensureHook(config: TomlRecord, spec: HookSpec): boolean {
  const hooks = hooksConfig(config);
  let changed = false;

  const existingGroups = hooks[spec.eventName];
  const groups = Array.isArray(existingGroups) ? existingGroups : [];
  if (!Array.isArray(existingGroups)) {
    hooks[spec.eventName] = groups;
    changed = true;
  }

  let group = groups.find(
    (candidate): candidate is TomlRecord =>
      isRecord(candidate) && matcherMatches(candidate, spec.matcher),
  );

  if (!group) {
    group =
      spec.matcher === undefined
        ? { hooks: [] }
        : { matcher: spec.matcher, hooks: [] };
    groups.push(group);
    changed = true;
  }

  const existingHooks = group.hooks;
  const commandHooks = Array.isArray(existingHooks) ? existingHooks : [];
  if (!Array.isArray(existingHooks)) {
    group.hooks = commandHooks;
    changed = true;
  }

  const existingHook = commandHooks.find(hookEntryMatches);
  if (existingHook) {
    if (existingHook.type !== "command") {
      existingHook.type = "command";
      changed = true;
    }
    if (existingHook.timeout !== HOOK_TIMEOUT_SECONDS) {
      existingHook.timeout = HOOK_TIMEOUT_SECONDS;
      changed = true;
    }
    return changed;
  }

  commandHooks.push({
    type: "command",
    command: HOOK_COMMAND,
    timeout: HOOK_TIMEOUT_SECONDS,
  });
  return true;
}

function removeHook(
  config: TomlRecord,
  eventName: HookSpec["eventName"],
): boolean {
  const hooks = isRecord(config.hooks) ? config.hooks : undefined;
  if (!hooks) {
    return false;
  }

  const groups = hooks[eventName];
  if (!Array.isArray(groups)) {
    return false;
  }

  let changed = false;
  const nextGroups: unknown[] = [];

  for (const group of groups) {
    if (!isRecord(group)) {
      nextGroups.push(group);
      continue;
    }

    const commandHooks = group.hooks;
    if (!Array.isArray(commandHooks)) {
      nextGroups.push(group);
      continue;
    }

    const nextHooks = commandHooks.filter((entry) => !hookEntryMatches(entry));
    if (nextHooks.length !== commandHooks.length) {
      changed = true;
      group.hooks = nextHooks;
    }

    if (nextHooks.length > 0) {
      nextGroups.push(group);
    } else {
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  if (nextGroups.length > 0) {
    hooks[eventName] = nextGroups;
  } else {
    delete hooks[eventName];
  }

  if (Object.keys(hooks).length === 0) {
    delete config.hooks;
  }

  return true;
}

/**
 * Install Codex hooks into Codex config
 */
export function installHook(): void {
  console.log("Installing codex-wakatime Codex hooks...");

  // Ensure .codex directory exists
  const codexDir = path.dirname(CODEX_CONFIG_PATH);
  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
    console.log(`Created ${codexDir}`);
  }

  // Read existing config or create new one
  let config: Record<string, unknown> = {};
  if (fs.existsSync(CODEX_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(CODEX_CONFIG_PATH, "utf-8");
      config = TOML.parse(content) as Record<string, unknown>;
      console.log("Found existing Codex config");
    } catch {
      console.warn("Could not parse existing config, creating new one");
    }
  }

  let changed = false;
  changed = ensureCodexHooksFeature(config) || changed;
  for (const spec of HOOK_SPECS) {
    changed = ensureHook(config, spec) || changed;
  }

  if (isOwnedLegacyNotify(config.notify)) {
    delete config.notify;
    changed = true;
  }

  if (!changed) {
    console.log("codex-wakatime is already configured");
    return;
  }

  // Write the config
  const newContent = TOML.stringify(config as TOML.JsonMap);
  fs.writeFileSync(CODEX_CONFIG_PATH, newContent);

  console.log(`Updated ${CODEX_CONFIG_PATH}`);
  console.log("codex-wakatime Codex hooks installed successfully!");
  console.log("");
  console.log(
    "Make sure you have your WakaTime API key configured in ~/.wakatime.cfg",
  );
}

/**
 * Uninstall Codex hooks from Codex config
 */
export function uninstallHook(): void {
  console.log("Uninstalling codex-wakatime Codex hooks...");

  if (!fs.existsSync(CODEX_CONFIG_PATH)) {
    console.log("No Codex config found, nothing to uninstall");
    return;
  }

  try {
    const content = fs.readFileSync(CODEX_CONFIG_PATH, "utf-8");
    const config = TOML.parse(content) as Record<string, unknown>;

    let changed = false;
    for (const spec of HOOK_SPECS) {
      changed = removeHook(config, spec.eventName) || changed;
    }

    if (isOwnedLegacyNotify(config.notify)) {
      delete config.notify;
      changed = true;
    }

    if (!changed) {
      console.log("codex-wakatime was not configured");
      return;
    }

    const newContent = TOML.stringify(config as TOML.JsonMap);
    fs.writeFileSync(CODEX_CONFIG_PATH, newContent);
    console.log("codex-wakatime Codex hooks removed");
  } catch (err) {
    console.error("Error uninstalling hook:", err);
  }
}
