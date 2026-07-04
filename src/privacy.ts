import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { HeartbeatParams } from "./types.js";

const WAKATIME_CONFIG = path.join(os.homedir(), ".wakatime.cfg");

interface PrivacyConfig {
  root?: string;
  project?: string;
  entityRoot?: string;
}

function parseConfig(): PrivacyConfig {
  const config: PrivacyConfig = {
    root: process.env.CODEX_WAKATIME_PRIVACY_ROOT,
    project: process.env.CODEX_WAKATIME_PRIVACY_PROJECT,
    entityRoot: process.env.CODEX_WAKATIME_PRIVACY_ENTITY_ROOT,
  };

  if (!fs.existsSync(WAKATIME_CONFIG)) {
    return config;
  }

  const content = fs.readFileSync(WAKATIME_CONFIG, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!value) continue;

    if (!config.root && key === "codex_wakatime_privacy_root") {
      config.root = value;
    }
    if (!config.project && key === "codex_wakatime_privacy_project") {
      config.project = value;
    }
    if (!config.entityRoot && key === "codex_wakatime_privacy_entity_root") {
      config.entityRoot = value;
    }
  }

  return config;
}

function isUnderRoot(value: string | undefined, root: string): boolean {
  if (!value) return false;
  const normalized = path.resolve(value);
  return normalized === root || normalized.startsWith(`${root}/`);
}

function vagueFilePath(entity: string, entityRoot: string): string {
  const ext = path.extname(entity);
  return path.join(entityRoot, `vague_file${ext}`);
}

export function anonymizeHeartbeat(params: HeartbeatParams): HeartbeatParams {
  const config = parseConfig();
  if (!config.root || !config.project) {
    return params;
  }

  const root = path.resolve(config.root);
  const entityRoot = config.entityRoot ?? root;
  const isCodexHeartbeat =
    isUnderRoot(params.entity, root) || isUnderRoot(params.projectFolder, root);

  if (!isCodexHeartbeat) {
    return params;
  }

  if (params.entityType === "file") {
    return {
      ...params,
      entity: vagueFilePath(params.entity, entityRoot),
      projectFolder: root,
      project: config.project,
    };
  }

  return {
    ...params,
    entity: entityRoot,
    projectFolder: root,
    project: config.project,
  };
}
