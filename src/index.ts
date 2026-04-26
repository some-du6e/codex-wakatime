import * as fs from "node:fs";
import * as path from "node:path";
import { extractFiles } from "./extractor.js";
import { installHook, uninstallHook } from "./install.js";
import { LogLevel, logger } from "./logger.js";
import { isDebugEnabled } from "./options.js";
import { parseHookInput, parseLegacyNotification } from "./parser.js";
import { shouldSendHeartbeat, updateLastHeartbeat } from "./state.js";
import type { ExtractedFile, UsageEvent } from "./types.js";
import { ensureCliInstalled, sendHeartbeat } from "./wakatime.js";

/**
 * Parse the usage event from either legacy notify argv or Codex hook stdin.
 */
function parseUsageEvent(args: string[]): UsageEvent | undefined {
  try {
    if (args.includes("--hook")) {
      return parseHookInput(fs.readFileSync(0, "utf-8"));
    }
    return parseLegacyNotification(args[0]);
  } catch (err) {
    logger.warnException(err);
    return undefined;
  }
}

function filesForEvent(event: UsageEvent): ExtractedFile[] {
  if (event.files) {
    return event.files;
  }
  return extractFiles(event.assistantMessage ?? "", event.cwd);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle install/uninstall flags
  if (args.includes("--install")) {
    installHook();
    return;
  }

  if (args.includes("--uninstall")) {
    uninstallHook();
    return;
  }

  // Set log level based on debug config
  if (isDebugEnabled()) {
    logger.setLevel(LogLevel.DEBUG);
  }

  logger.debug("codex-wakatime started");

  const event = parseUsageEvent(args);
  if (!event) {
    logger.debug("No valid usage event received");
    return;
  }

  const files = filesForEvent(event);
  logger.debug(`Received usage event: ${event.kind}`);
  logger.debug(`Extracted ${files.length} files from event`);
  if (event.kind === "tool" && files.length === 0) {
    logger.debug("Skipping tool event without file heartbeats");
    return;
  }

  // Check rate limiting
  if (!shouldSendHeartbeat()) {
    logger.debug("Skipping heartbeat due to rate limiting");
    return;
  }

  // Ensure CLI is installed
  const cliAvailable = await ensureCliInstalled();
  if (!cliAvailable) {
    logger.warn("wakatime-cli not available, skipping heartbeat");
    return;
  }

  if (files.length > 0) {
    // Send per-file heartbeats
    for (const file of files) {
      logger.debug(
        `Sending heartbeat for file: ${file.path} (isWrite: ${file.isWrite})`,
      );
      sendHeartbeat({
        entity: file.path,
        entityType: "file",
        category: "ai coding",
        projectFolder: event.cwd,
        isWrite: file.isWrite,
        client: event.client,
      });
    }
  } else {
    // Fallback: project-level heartbeat
    logger.debug(`Sending project heartbeat for: ${event.cwd}`);
    sendHeartbeat({
      entity: event.cwd,
      entityType: "app",
      category: "ai coding",
      project: path.basename(event.cwd),
      client: event.client,
    });
  }

  // Update rate limiting state
  updateLastHeartbeat();

  logger.debug("codex-wakatime completed");
}

// Run main
main().catch((err) => {
  logger.errorException(err);
  process.exit(1);
});
