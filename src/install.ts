import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import TOML from "@iarna/toml";

const CODEX_CONFIG_PATH = path.join(os.homedir(), ".codex", "config.toml");

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

/**
 * Get the path to the installed codex-wakatime binary
 */
function getPluginCommand(): string[] {
  // Use the globally installed command if available
  return ["codex-wakatime"];
}

/**
 * Install the notification hook into Codex config
 */
export function installHook(): void {
  console.log("Installing codex-wakatime notification hook...");

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

  // Get the plugin command
  const pluginCommand = getPluginCommand()[0];

  // Check if already installed
  const existingNotify = normalizeNotifyCommand(config.notify);
  if (existingNotify?.[0] === pluginCommand) {
    console.log("codex-wakatime is already configured");
    return;
  }

  if (existingNotify && existingNotify.length > 0) {
    console.warn(
      "Existing Codex notify command found; replacing with codex-wakatime",
    );
  }

  // Set the notify command (Codex supports a single command argv)
  config.notify = [pluginCommand];

  // Write the config
  const newContent = TOML.stringify(config as TOML.JsonMap);
  fs.writeFileSync(CODEX_CONFIG_PATH, newContent);

  console.log(`Updated ${CODEX_CONFIG_PATH}`);
  console.log("codex-wakatime notification hook installed successfully!");
  console.log("");
  console.log(
    "Make sure you have your WakaTime API key configured in ~/.wakatime.cfg",
  );
}

/**
 * Uninstall the notification hook from Codex config
 */
export function uninstallHook(): void {
  console.log("Uninstalling codex-wakatime notification hook...");

  if (!fs.existsSync(CODEX_CONFIG_PATH)) {
    console.log("No Codex config found, nothing to uninstall");
    return;
  }

  try {
    const content = fs.readFileSync(CODEX_CONFIG_PATH, "utf-8");
    const config = TOML.parse(content) as Record<string, unknown>;

    const pluginCommand = getPluginCommand()[0];
    const existingNotify = normalizeNotifyCommand(config.notify);
    if (!existingNotify || existingNotify[0] !== pluginCommand) {
      console.log("codex-wakatime was not configured");
      return;
    }

    delete config.notify;

    const newContent = TOML.stringify(config as TOML.JsonMap);
    fs.writeFileSync(CODEX_CONFIG_PATH, newContent);
    console.log("codex-wakatime notification hook removed");
  } catch (err) {
    console.error("Error uninstalling hook:", err);
  }
}
