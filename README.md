# codex-wakatime

[![npm version](https://img.shields.io/npm/v/codex-wakatime)](https://www.npmjs.com/package/codex-wakatime)
[![npm downloads](https://img.shields.io/npm/dm/codex-wakatime)](https://www.npmjs.com/package/codex-wakatime)
[![CI](https://github.com/angristan/codex-wakatime/actions/workflows/workflow.yml/badge.svg)](https://github.com/angristan/codex-wakatime/actions/workflows/workflow.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

WakaTime integration for [OpenAI Codex CLI](https://github.com/openai/codex). Track AI coding activity and time spent.

> [!TIP]
> Also check out [opencode-wakatime](https://github.com/angristan/opencode-wakatime) for OpenCode!

## Features

- Automatic time tracking for Codex CLI sessions
- File-level activity detection via message parsing
- 60-second heartbeat rate limiting
- Automatic WakaTime CLI installation and updates
- Cross-platform support (macOS, Linux, Windows)

## Prerequisites

1. [WakaTime account](https://wakatime.com) and API key
2. WakaTime API key configured in `~/.wakatime.cfg`:
   ```ini
   [settings]
   api_key = your-api-key-here
   ```
3. [Codex CLI](https://github.com/openai/codex) installed

## Installation

```bash
# Install the package
npm install -g codex-wakatime

# Configure Codex hooks
codex-wakatime --install
```

This adds `Stop` and `PostToolUse` hooks to your `~/.codex/config.toml`.
If an older `notify = ["codex-wakatime"]` entry exists, it is migrated to hooks.
Other `notify` commands are preserved.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Codex CLI Session                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Stop / PostToolUse hooks                        │
│   Codex sends hook payloads with:                             │
│   - session-id, turn-id                                      │
│   - cwd (working directory)                                  │
│   - last-assistant-message on Stop                           │
│   - apply_patch input on PostToolUse                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   codex-wakatime                             │
│   1. Parse hook JSON from stdin                              │
│   2. Extract file paths from apply_patch or assistant text   │
│   3. Check 60-second rate limit                              │
│   4. Send heartbeat(s) to WakaTime                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   WakaTime Dashboard                         │
│   View your AI coding metrics at wakatime.com                │
└─────────────────────────────────────────────────────────────┘
```

### Codex Hooks

| Event | Purpose |
|-------|---------|
| `Stop` | Sends a turn-level heartbeat after each Codex turn completes |
| `PostToolUse` (`apply_patch`) | Sends file-level write heartbeats for patch edits |

Legacy `agent-turn-complete` notify payloads are still supported for existing
manual setups.

### File Detection Patterns

The plugin extracts edited files directly from `apply_patch` hook payloads. For
turn-level fallback heartbeats, it extracts file paths from the assistant's
response using these patterns:

- **Code block headers**: ` ```typescript:src/index.ts `
- **Backtick paths**: `` `src/file.ts` ``
- **Action patterns**: `Created src/file.ts`, `Modified package.json`
- **Quoted paths**: `"src/file.ts"` or `'src/file.ts'`

If no files are detected, a project-level heartbeat is sent using the working directory.

## Configuration

The plugin auto-configures `~/.codex/config.toml` on installation:

```toml
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
```

### Debug Mode

Enable debug logging by adding to `~/.wakatime.cfg`:

```ini
[settings]
debug = true
```

Logs are written to `~/.wakatime/codex.log`.

## Files & Locations

| File | Purpose |
|------|---------|
| `~/.wakatime/codex.json` | Rate limiting state |
| `~/.wakatime/codex.log` | Debug logs |
| `~/.wakatime/codex-cli-state.json` | CLI version tracking |
| `~/.codex/config.toml` | Codex configuration |
| `~/.wakatime.cfg` | WakaTime API key and settings |

## Development

```bash
# Clone the repository
git clone https://github.com/angristan/codex-wakatime
cd codex-wakatime

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run check
```

### Project Structure

```
codex-wakatime/
├── src/
│   ├── index.ts          # Main entry point
│   ├── install.ts        # Hook installation
│   ├── extractor.ts      # File path extraction
│   ├── wakatime.ts       # CLI invocation
│   ├── dependencies.ts   # CLI management
│   ├── state.ts          # Rate limiting
│   ├── logger.ts         # Logging
│   ├── options.ts        # Config parsing
│   ├── types.ts          # TypeScript interfaces
│   └── __tests__/        # Test files
├── package.json
├── tsconfig.json
└── biome.json
```

## Uninstall

```bash
# Remove the notification hook
codex-wakatime --uninstall

# Uninstall the package
npm uninstall -g codex-wakatime
```

## Commands

| Command | Description |
|---------|-------------|
| `codex-wakatime --install` | Add Codex hooks to Codex config |
| `codex-wakatime --uninstall` | Remove Codex hooks from Codex config |
| `codex-wakatime --hook` | Process a Codex hook payload from stdin |
| `codex-wakatime '{"type":"agent-turn-complete",...}'` | Process a notification (called by Codex) |

## Troubleshooting

### No heartbeats being sent

1. Check that your API key is configured in `~/.wakatime.cfg`
2. Verify the Codex hooks are set in `~/.codex/config.toml`
3. Enable debug mode and check `~/.wakatime/codex.log`

### Rate limiting

Heartbeats are rate-limited to once per 60 seconds. If you're testing, wait at least 60 seconds between Codex turns.

### CLI not found

The plugin automatically downloads `wakatime-cli` if not found. If this fails:

1. Check your internet connection
2. Manually install: https://github.com/wakatime/wakatime-cli/releases
3. Ensure `wakatime-cli` is in your PATH

## License

MIT
