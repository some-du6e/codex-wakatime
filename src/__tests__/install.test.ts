import * as fs from "node:fs";
import * as os from "node:os";
import TOML from "@iarna/toml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs");
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/user"),
}));

const { installHook, uninstallHook } = await import("../install.js");

function writtenConfig(): Record<string, unknown> {
  const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
  return TOML.parse(written) as Record<string, unknown>;
}

function hookCommands(
  config: Record<string, unknown>,
  eventName: string,
): string[] {
  const hooks = config.hooks as Record<string, unknown>;
  const groups = hooks[eventName] as Array<Record<string, unknown>>;
  return groups.flatMap((group) =>
    (group.hooks as Array<Record<string, unknown>>).map(
      (hook) => hook.command as string,
    ),
  );
}

describe("install", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue("/home/user");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs Stop and PostToolUse hooks while preserving unrelated notify", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('notify = ["hook-a"]\n');

    installHook();

    const config = writtenConfig();
    expect(config.notify).toEqual(["hook-a"]);
    expect((config.features as Record<string, unknown>).codex_hooks).toBe(true);
    expect(hookCommands(config, "Stop")).toEqual(["codex-wakatime --hook"]);
    expect(hookCommands(config, "PostToolUse")).toEqual([
      "codex-wakatime --hook",
    ]);
    const postToolUseGroups = (config.hooks as Record<string, unknown>)
      .PostToolUse as Array<Record<string, unknown>>;
    expect(postToolUseGroups[0]?.matcher).toBe("apply_patch");
  });

  it("does not overwrite when codex-wakatime is already configured", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
[features]
codex_hooks = true

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60

[[hooks.PostToolUse]]
matcher = "apply_patch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60
`);

    installHook();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("enables Codex hooks while preserving existing feature flags", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
[features]
unified_exec = true
`);

    installHook();

    const config = writtenConfig();
    expect(config.features).toEqual({
      codex_hooks: true,
      unified_exec: true,
    });
    expect(hookCommands(config, "Stop")).toEqual(["codex-wakatime --hook"]);
    expect(hookCommands(config, "PostToolUse")).toEqual([
      "codex-wakatime --hook",
    ]);
  });

  it("migrates owned legacy notify to hooks", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('notify = ["codex-wakatime"]\n');

    installHook();

    const config = writtenConfig();
    expect(config.notify).toBeUndefined();
    expect(hookCommands(config, "Stop")).toEqual(["codex-wakatime --hook"]);
    expect(hookCommands(config, "PostToolUse")).toEqual([
      "codex-wakatime --hook",
    ]);
  });

  it("removes codex-wakatime hooks and owned legacy notify", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
notify = ["codex-wakatime"]

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60

[[hooks.PostToolUse]]
matcher = "apply_patch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60
`);

    uninstallHook();

    const config = writtenConfig();
    expect(config.notify).toBeUndefined();
    expect(config.hooks).toBeUndefined();
  });

  it("preserves unrelated hooks and notify during uninstall", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
notify = ["hook-a"]

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "other-stop"
timeout = 10

[[hooks.Stop.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60

[[hooks.PostToolUse]]
matcher = "apply_patch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "codex-wakatime --hook"
timeout = 60
`);

    uninstallHook();

    const config = writtenConfig();
    expect(config.notify).toEqual(["hook-a"]);
    expect(hookCommands(config, "Stop")).toEqual(["other-stop"]);
    expect(
      (config.hooks as Record<string, unknown>).PostToolUse,
    ).toBeUndefined();
  });

  it("does not write when codex-wakatime is not configured", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('notify = ["hook-a"]\n');

    uninstallHook();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
