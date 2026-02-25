import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BOT_PLAYER_ROOT = path.resolve(__dirname, "..");

export function printHelp() {
  console.log(`Save the Grid Bot Player

Usage:
  node run-bot.mjs --url <game_url> [--scenario <path>] [options]

Required:
  --url                     Game URL to open (example: http://localhost:5173)

Optional:
  --scenario                JSON scenario path (default: ./scenarios/smoke-menu-to-run.json)
  --headed                  Run with a visible browser window
  --headless <true|false>   Override headless mode explicitly
  --timeout <ms>            Default timeout in milliseconds (default: 7000)
  --step-delay <ms>         Delay between steps in milliseconds (default: 250)
  --slow-mo <ms>            Playwright slow-motion delay
  --screenshot-dir <path>   Output directory for screenshots (default: ./artifacts)
  --fail-on-console-error   Exit non-zero if console errors are captured (default: true)
  --no-final-screenshot     Skip the final screenshot
  --help                    Show this help output

Scenario step actions:
  wait, waitFor, click, press, type, assertText, advanceTime, autoplay, tutorialBeat, screenshot
`);
}

export function parseArgs(argv) {
  const output = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex !== -1) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      output[key] = value === "" ? true : value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      output[key] = true;
    } else {
      output[key] = next;
      i += 1;
    }
  }

  return output;
}

export function toNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

export function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function resolveScenarioPath(rawPath) {
  if (!rawPath) {
    return path.join(BOT_PLAYER_ROOT, "scenarios", "smoke-menu-to-run.json");
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export function resolveScreenshotDir(rawPath) {
  if (!rawPath) {
    return path.join(BOT_PLAYER_ROOT, "artifacts");
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  const cwd = process.cwd();
  const normalized = String(rawPath).replaceAll("\\", "/");
  if (path.basename(cwd) === "bot-player" && normalized.startsWith("bot-player/")) {
    return path.resolve(cwd, normalized.slice("bot-player/".length));
  }

  return path.resolve(cwd, rawPath);
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
