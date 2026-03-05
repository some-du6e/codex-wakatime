import * as path from "node:path";
import type { ExtractedFile } from "./types.js";

/**
 * Patterns to extract file paths from assistant messages (no write detection)
 */
const READ_PATTERNS = [
  // Code block headers: ```typescript:src/index.ts or ```ts:src/index.ts
  /```\w*:([^\n`]+)/g,

  // Backtick paths with extension: `src/foo/bar.ts`
  /`([^`\s]+\.\w{1,6})`/g,

  // File path in quotes: "src/file.ts" or 'src/file.ts'
  /["']([^"'\s]+\.\w{1,6})["']/g,

  // Read action patterns: Read/List file.ts
  /(?:Read|List)\s+`?([^\s`\n]+\.\w{1,6})`?/gi,
];

/**
 * Pattern for write actions: Create/Modify/Update/Write/Edit/Delete file.ts
 */
const WRITE_PATTERN =
  /(?:Create|Created|Modify|Modified|Update|Updated|Write|Wrote|Edit|Edited|Delete|Deleted)\s+`?([^\s`\n]+\.\w{1,6})`?/gi;

/**
 * Check if a string looks like a valid file path
 */
function isValidFilePath(p: string): boolean {
  // Must not be empty
  if (!p || p.length === 0) return false;

  // Must not be a URL
  if (p.startsWith("http://") || p.startsWith("https://") || p.includes("://"))
    return false;

  // Must not contain invalid characters
  if (/[<>|?*]/.test(p)) return false;

  // Must have a file extension
  const ext = path.extname(p).slice(1).toLowerCase();
  if (!ext) return false;

  // Extension should be reasonable length
  if (ext.length > 6) return false;

  // Prefer known extensions, but allow others
  // (to support less common file types)
  return true;
}

/**
 * Normalize a file path (resolve relative paths, clean up)
 */
function normalizePath(filePath: string, cwd: string): string {
  // Remove leading/trailing whitespace
  const cleaned = filePath.trim();

  // If absolute, return as-is
  if (path.isAbsolute(cleaned)) {
    return path.normalize(cleaned);
  }

  // Resolve relative to cwd
  return path.normalize(path.join(cwd, cleaned));
}

/**
 * Extract files from an assistant message with write detection
 *
 * @param message - The assistant's response message
 * @param cwd - Current working directory for resolving relative paths
 * @returns Array of ExtractedFile objects with path and isWrite flag
 */
export function extractFiles(message: string, cwd: string): ExtractedFile[] {
  if (!message || message.length === 0) {
    return [];
  }

  // Track files with their write status (write wins over read if both detected)
  const fileMap = new Map<string, boolean>();

  // First, extract write actions (these take priority)
  WRITE_PATTERN.lastIndex = 0;
  for (const match of message.matchAll(WRITE_PATTERN)) {
    const filePath = match[1];
    if (filePath && isValidFilePath(filePath)) {
      const normalized = normalizePath(filePath, cwd);
      fileMap.set(normalized, true); // Mark as write
    }
  }

  // Then extract read patterns (only if not already marked as write)
  for (const pattern of READ_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of message.matchAll(pattern)) {
      const filePath = match[1];
      if (filePath && isValidFilePath(filePath)) {
        const normalized = normalizePath(filePath, cwd);
        // Only add if not already present (writes take priority)
        if (!fileMap.has(normalized)) {
          fileMap.set(normalized, false); // Mark as read
        }
      }
    }
  }

  // Convert map to ExtractedFile array
  return Array.from(fileMap.entries()).map(([filePath, isWrite]) => ({
    path: filePath,
    isWrite,
  }));
}
