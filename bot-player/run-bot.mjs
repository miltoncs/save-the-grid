#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
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

function parseArgs(argv) {
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

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function toBoolean(value, fallback) {
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

function resolveScenarioPath(rawPath) {
  if (!rawPath) {
    return path.join(__dirname, "scenarios", "smoke-menu-to-run.json");
  }
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function loadScenario(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) {
    throw new Error(`Invalid scenario file: ${filePath}`);
  }
  return parsed;
}

function normalizeTargets(step) {
  if (Array.isArray(step.targets) && step.targets.length > 0) {
    return step.targets;
  }
  return [step];
}

function stepTimeout(step, runtime) {
  const fallback = step.optional ? Math.min(runtime.timeoutMs, 1500) : runtime.timeoutMs;
  return toNumber(step.timeoutMs, fallback);
}

function buildLocator(page, target) {
  if (target.selector) {
    return page.locator(target.selector).nth(target.index ?? 0);
  }

  if (target.role) {
    const options = {};
    if (target.name !== undefined) {
      options.name = target.name;
    }
    if (target.exact !== undefined) {
      options.exact = Boolean(target.exact);
    }
    return page.getByRole(target.role, options).nth(target.index ?? 0);
  }

  if (target.text !== undefined) {
    return page.getByText(target.text, { exact: Boolean(target.exact) }).nth(target.index ?? 0);
  }

  return null;
}

function describeTarget(target) {
  if (target.selector) {
    return `selector=${target.selector}`;
  }
  if (target.role) {
    return `role=${target.role} name=${target.name ?? "(any)"}`;
  }
  if (target.text !== undefined) {
    return `text=${target.text}`;
  }
  return "unknown-target";
}

async function takeScreenshot(page, screenshotDir, name, fullPage = false) {
  await fs.mkdir(screenshotDir, { recursive: true });
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(name) || "shot"}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: Boolean(fullPage) });
  return filePath;
}

async function performWait(page, step, runtime) {
  const ms = toNumber(step.ms, runtime.stepDelayMs);
  await page.waitForTimeout(Math.max(0, ms));
}

async function performWaitFor(page, step, runtime) {
  const timeout = stepTimeout(step, runtime);
  const state = step.state || "visible";
  const targets = normalizeTargets(step);
  const errors = [];

  for (const target of targets) {
    const locator = buildLocator(page, target);
    if (!locator) {
      continue;
    }

    try {
      await locator.waitFor({ state, timeout });
      return;
    } catch (error) {
      errors.push(`${describeTarget(target)} => ${error.message}`);
    }
  }

  throw new Error(`waitFor failed (${errors.join(" | ") || "no valid targets"})`);
}

async function performClick(page, step, runtime) {
  const timeout = stepTimeout(step, runtime);
  const targets = normalizeTargets(step);
  const errors = [];
  const clickOptions = {
    timeout,
    button: step.button || "left",
    clickCount: Math.max(1, toNumber(step.clickCount, 1)),
    force: Boolean(step.force),
  };

  if (step.position && Number.isFinite(step.position.x) && Number.isFinite(step.position.y)) {
    clickOptions.position = { x: step.position.x, y: step.position.y };
  }

  if (Number.isFinite(step.x) && Number.isFinite(step.y)) {
    clickOptions.position = { x: step.x, y: step.y };
  }

  for (const target of targets) {
    const locator = buildLocator(page, target);
    if (!locator) {
      continue;
    }

    try {
      await locator.click(clickOptions);
      return;
    } catch (error) {
      errors.push(`${describeTarget(target)} => ${error.message}`);
    }
  }

  throw new Error(`click failed (${errors.join(" | ") || "no valid targets"})`);
}

async function performPress(page, step) {
  if (!step.key) {
    throw new Error("press step requires key");
  }
  await page.keyboard.press(step.key);
}

async function performType(page, step, runtime) {
  if (step.text === undefined) {
    throw new Error("type step requires text");
  }

  const timeout = stepTimeout(step, runtime);
  const targets = normalizeTargets(step);
  const errors = [];

  for (const target of targets) {
    const locator = buildLocator(page, target);
    if (!locator) {
      continue;
    }

    try {
      if (step.clear !== false) {
        await locator.fill("", { timeout });
      }
      await locator.type(String(step.text), { timeout });
      if (step.submit) {
        await locator.press("Enter");
      }
      return;
    } catch (error) {
      errors.push(`${describeTarget(target)} => ${error.message}`);
    }
  }

  throw new Error(`type failed (${errors.join(" | ") || "no valid targets"})`);
}

async function performAssertText(page, step, runtime) {
  const timeout = stepTimeout(step, runtime);
  const locator = step.selector ? page.locator(step.selector).first() : page.locator("body");
  const text = await locator.innerText({ timeout });

  if (step.contains !== undefined && !text.includes(String(step.contains))) {
    throw new Error(`assertText contains failed (expected "${step.contains}")`);
  }

  if (step.notContains !== undefined && text.includes(String(step.notContains))) {
    throw new Error(`assertText notContains failed (found "${step.notContains}")`);
  }

  if (step.matches !== undefined) {
    const regex = new RegExp(String(step.matches), step.flags || "");
    if (!regex.test(text)) {
      throw new Error(`assertText regex failed (${regex.toString()})`);
    }
  }
}

async function performAdvanceTime(page, step, runtime) {
  const ms = toNumber(step.ms, runtime.stepDelayMs);
  const usedHook = await page.evaluate((timeMs) => {
    if (typeof window.advanceTime === "function") {
      window.advanceTime(timeMs);
      return true;
    }
    return false;
  }, ms);

  if (!usedHook) {
    await page.waitForTimeout(Math.max(0, ms));
  }
}

async function readRenderState(page) {
  const raw = await page.evaluate(() => {
    if (typeof window.render_game_to_text !== "function") {
      return null;
    }
    return window.render_game_to_text();
  });

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`render_game_to_text JSON parse failed: ${error.message}`);
  }
}

function listEntitiesWithPositions(state) {
  const towns = Array.isArray(state?.towns) ? state.towns : [];
  const nodes = Array.isArray(state?.infrastructurePoints) ? state.infrastructurePoints : [];
  return [...towns, ...nodes].filter(
    (entity) => Number.isFinite(entity?.x) && Number.isFinite(entity?.y),
  );
}

function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function pickPrimaryTown(state, memory) {
  const towns = Array.isArray(state?.towns) ? state.towns : [];
  if (!towns.length) return null;

  if (memory.townId) {
    const remembered = towns.find((town) => town.id === memory.townId);
    if (remembered) return remembered;
  }

  const capital =
    towns.find((town) => /capital/i.test(String(town?.name || ""))) ||
    towns.find((town) => /capital/i.test(String(town?.id || "")));
  const selected = capital || towns[0];
  memory.townId = selected.id;
  return selected;
}

function findOpenWorldPoint(state, anchor, entities, options = {}) {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    return null;
  }

  const mapWidth = Number(state?.coordinateSystem?.mapSize?.width || 2200);
  const mapHeight = Number(state?.coordinateSystem?.mapSize?.height || 1400);
  const margin = Math.max(20, Number(options.margin || 36));
  const minEntityClearance = Math.max(24, Number(options.minEntityClearance || 82));
  const minAvoidClearance = Math.max(24, Number(options.minAvoidClearance || 110));
  const avoidPoints = Array.isArray(options.avoidPoints) ? options.avoidPoints : [];
  const radiusSamples = Array.isArray(options.radiusSamples)
    ? options.radiusSamples
    : [96, 120, 150, 180, 220, 260, 320];
  const angleSamples = Array.isArray(options.angleSamples)
    ? options.angleSamples
    : [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  for (const radius of radiusSamples) {
    for (const angleDeg of angleSamples) {
      const angle = (angleDeg * Math.PI) / 180;
      const candidate = {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
      };

      if (
        candidate.x < margin ||
        candidate.y < margin ||
        candidate.x > mapWidth - margin ||
        candidate.y > mapHeight - margin
      ) {
        continue;
      }

      let blocked = false;
      for (const entity of entities) {
        if (distance(candidate, entity) < minEntityClearance) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (const point of avoidPoints) {
        if (!point) continue;
        if (distance(candidate, point) < minAvoidClearance) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      return candidate;
    }
  }

  return null;
}

async function clickWorldPoint(page, state, worldPoint, canvasSelector) {
  if (!Number.isFinite(worldPoint?.x) || !Number.isFinite(worldPoint?.y)) {
    throw new Error("invalid world point");
  }

  const camera = state?.coordinateSystem?.camera;
  if (
    !camera ||
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.zoom)
  ) {
    throw new Error("missing camera data from render_game_to_text");
  }

  const canvas = page.locator(canvasSelector).first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error(`canvas bounding box unavailable for ${canvasSelector}`);
  }

  const screenX = (worldPoint.x - camera.x) * camera.zoom + box.width / 2;
  const screenY = (worldPoint.y - camera.y) * camera.zoom + box.height / 2;
  const absoluteX = box.x + screenX;
  const absoluteY = box.y + screenY;

  if (
    absoluteX < box.x + 2 ||
    absoluteY < box.y + 2 ||
    absoluteX > box.x + box.width - 2 ||
    absoluteY > box.y + box.height - 2
  ) {
    throw new Error(
      `world point off-screen for current camera (${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)})`,
    );
  }

  await page.mouse.click(Math.round(absoluteX), Math.round(absoluteY), { button: "left" });
}

async function verifyTutorialEnd(page) {
  const endScreen = page.locator(".end-screen").first();
  const visible = await endScreen.isVisible().catch(() => false);
  if (!visible) {
    return { ended: false, tutorialComplete: false, text: "" };
  }
  const text = await endScreen.innerText().catch(() => "");
  const tutorialComplete = /tutorial complete|core controls verified/i.test(text);
  return { ended: true, tutorialComplete, text };
}

async function performTutorialBeat(page, step, runtime, log) {
  const canvasSelector = step.canvasSelector || "#game-canvas";
  const settleMs = Math.max(120, toNumber(step.settleMs, 320));
  const pauseMs = Math.max(80, toNumber(step.pauseMs, 180));
  const maxIterations = Math.max(1, toNumber(step.maxIterations, 120));
  const memory = {
    townId: null,
    plantPoint: null,
    substationPoint: null,
  };

  const centerButton = page.locator("#run-center-btn").first();
  if (await centerButton.isVisible().catch(() => false)) {
    await centerButton.click().catch(() => {});
  }

  for (let attempt = 0; attempt < maxIterations; attempt += 1) {
    const state = await readRenderState(page);
    if (!state) {
      throw new Error("render_game_to_text is unavailable");
    }

    if (state.mode !== "tutorial") {
      const endState = await verifyTutorialEnd(page);
      if (endState.ended && endState.tutorialComplete) {
        log("tutorial completion detected on end screen");
        return;
      }
      throw new Error(`expected tutorial mode, got "${state.mode}"`);
    }

    const tutorial = state.tutorial;
    if (!tutorial) {
      throw new Error("tutorial state payload missing");
    }
    if (tutorial.completed) {
      log("tutorial state reports completed");
      return;
    }

    const stepId = tutorial.currentStepId;
    if (!stepId) {
      throw new Error("tutorial currentStepId missing");
    }
    log(`tutorial step ${tutorial.completedSteps + 1}/${tutorial.totalSteps}: ${stepId}`);

    const targetTown = pickPrimaryTown(state, memory);
    const entities = listEntitiesWithPositions(state);
    const infrastructureNodes = Array.isArray(state.infrastructurePoints) ? state.infrastructurePoints : [];

    switch (stepId) {
      case "build_plant": {
        await page.keyboard.press("Digit1");
        if (!memory.plantPoint) {
          memory.plantPoint = findOpenWorldPoint(state, targetTown, entities, {
            minEntityClearance: 82,
            minAvoidClearance: 110,
          });
        }
        if (!memory.plantPoint) {
          throw new Error("unable to find open map point for plant placement");
        }
        await clickWorldPoint(page, state, memory.plantPoint, canvasSelector);
        break;
      }
      case "build_substation": {
        await page.keyboard.press("Digit2");
        if (!memory.substationPoint) {
          memory.substationPoint = findOpenWorldPoint(state, targetTown, entities, {
            minEntityClearance: 82,
            minAvoidClearance: 120,
            avoidPoints: [memory.plantPoint],
          });
        }
        if (!memory.substationPoint) {
          throw new Error("unable to find open map point for substation placement");
        }
        await clickWorldPoint(page, state, memory.substationPoint, canvasSelector);
        break;
      }
      case "build_line": {
        await page.keyboard.press("Digit4");
        const hostNodes = infrastructureNodes.filter(
          (node) =>
            Number(node?.assets?.plant || 0) > 0 || Number(node?.assets?.substation || 0) > 0,
        );
        if (hostNodes.length < 2) {
          await page.keyboard.press("Digit2");
          const extraPoint = findOpenWorldPoint(state, targetTown, entities, {
            minEntityClearance: 82,
            minAvoidClearance: 120,
            avoidPoints: [memory.plantPoint, memory.substationPoint],
            radiusSamples: [160, 210, 260, 320],
          });
          if (!extraPoint) {
            throw new Error("tutorial line step: unable to create second endpoint");
          }
          await clickWorldPoint(page, state, extraPoint, canvasSelector);
          break;
        }
        const start =
          hostNodes.find((node) => Number(node?.assets?.plant || 0) > 0) || hostNodes[0];
        const end =
          hostNodes.find(
            (node) => node.id !== start.id && Number(node?.assets?.substation || 0) > 0,
          ) || hostNodes.find((node) => node.id !== start.id);
        if (!start || !end) {
          throw new Error("tutorial line step: no two valid infrastructure endpoints");
        }
        await clickWorldPoint(page, state, { x: start.x, y: start.y }, canvasSelector);
        await page.waitForTimeout(Math.round(pauseMs / 2));
        await clickWorldPoint(page, state, { x: end.x, y: end.y }, canvasSelector);
        break;
      }
      case "service_town": {
        const servedTown = (state.towns || []).find(
          (town) => Number(town?.served || 0) > 0.1 && Boolean(town?.service?.coveredBySubstation),
        );
        if (!servedTown) {
          await performAdvanceTime(page, { ms: settleMs * 2 }, runtime);
        }
        break;
      }
      case "resource_reveal": {
        await page.keyboard.down("r");
        await page.waitForTimeout(pauseMs);
        await page.keyboard.up("r");
        break;
      }
      case "reroute": {
        await page.keyboard.press("KeyE");
        if (!targetTown) {
          throw new Error("tutorial reroute step: no town available");
        }
        await clickWorldPoint(page, state, { x: targetTown.x, y: targetTown.y }, canvasSelector);
        break;
      }
      case "demolish": {
        await page.keyboard.press("KeyX");
        const targetNode = infrastructureNodes.find((node) => {
          const assets = node?.assets || {};
          return (
            Number(assets.plant || 0) +
              Number(assets.substation || 0) +
              Number(assets.storage || 0) >
            0
          );
        });
        if (!targetNode) {
          throw new Error("tutorial demolish step: no infrastructure asset found to remove");
        }
        await clickWorldPoint(page, state, { x: targetNode.x, y: targetNode.y }, canvasSelector);
        break;
      }
      case "pause_resume": {
        await page.keyboard.press("Space");
        await page.waitForTimeout(pauseMs);
        await page.keyboard.press("Space");
        break;
      }
      default:
        throw new Error(`tutorial step not supported by bot: ${stepId}`);
    }

    let progressed = false;
    for (let poll = 0; poll < 8; poll += 1) {
      await performAdvanceTime(page, { ms: settleMs }, runtime);
      const next = await readRenderState(page);
      if (!next) continue;
      if (next.mode !== "tutorial") {
        const endState = await verifyTutorialEnd(page);
        if (endState.ended && endState.tutorialComplete) {
          log("tutorial completion detected after step action");
          return;
        }
        throw new Error(`run exited tutorial unexpectedly (mode=${next.mode})`);
      }
      if (
        next?.tutorial?.completed ||
        (next?.tutorial?.currentStepId && next.tutorial.currentStepId !== stepId)
      ) {
        progressed = true;
        break;
      }
    }

    if (!progressed) {
      log(`tutorial step "${stepId}" not advanced yet; retrying`);
    }
  }

  const finalState = await readRenderState(page);
  if (finalState?.mode !== "tutorial") {
    const endState = await verifyTutorialEnd(page);
    if (endState.ended && endState.tutorialComplete) {
      return;
    }
  }
  throw new Error("tutorialBeat exceeded max iterations before completion");
}

async function performAutoplay(page, step, runtime, log) {
  const selectors = Array.isArray(step.selectors) ? step.selectors : [];
  const iterations = Math.max(1, toNumber(step.iterations, 8));
  const timeout = stepTimeout(step, runtime);
  const dwellMs = Math.max(0, toNumber(step.dwellMs, runtime.stepDelayMs));
  const idleKey = step.idleKey ? String(step.idleKey) : "";
  const allowCanvasClick = step.allowCanvasClick !== false;
  const canvasSelector = step.canvasSelector || "canvas";
  const advanceMs = toNumber(step.advanceMs, 0);

  for (let i = 0; i < iterations; i += 1) {
    let acted = false;

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      try {
        await locator.click({ timeout });
        acted = true;
        log(`autoplay iteration ${i + 1}: clicked ${selector}`);
        break;
      } catch {
        // Continue trying other selectors.
      }
    }

    if (!acted && allowCanvasClick) {
      const canvas = page.locator(canvasSelector).first();
      const isVisible = await canvas.isVisible().catch(() => false);
      if (isVisible) {
        const box = await canvas.boundingBox();
        if (box) {
          const left = box.x + 8;
          const right = box.x + Math.max(9, box.width - 8);
          const top = box.y + 8;
          const bottom = box.y + Math.max(9, box.height - 8);
          const x = left + Math.random() * (right - left);
          const y = top + Math.random() * (bottom - top);
          await page.mouse.click(Math.round(x), Math.round(y));
          acted = true;
          log(`autoplay iteration ${i + 1}: clicked canvas`);
        }
      }
    }

    if (!acted && idleKey) {
      await page.keyboard.press(idleKey);
      acted = true;
      log(`autoplay iteration ${i + 1}: pressed ${idleKey}`);
    }

    if (advanceMs > 0) {
      await performAdvanceTime(page, { ms: advanceMs }, runtime);
    }

    if (dwellMs > 0) {
      await page.waitForTimeout(dwellMs);
    }
  }
}

async function performScreenshot(page, step, runtime) {
  const filePath = await takeScreenshot(
    page,
    runtime.screenshotDir,
    step.name || "scenario-shot",
    Boolean(step.fullPage),
  );
  return filePath;
}

async function runStep(page, step, runtime, log) {
  switch (step.action) {
    case "wait":
      await performWait(page, step, runtime);
      return null;
    case "waitFor":
      await performWaitFor(page, step, runtime);
      return null;
    case "click":
      await performClick(page, step, runtime);
      return null;
    case "press":
      await performPress(page, step, runtime);
      return null;
    case "type":
      await performType(page, step, runtime);
      return null;
    case "assertText":
      await performAssertText(page, step, runtime);
      return null;
    case "advanceTime":
      await performAdvanceTime(page, step, runtime);
      return null;
    case "autoplay":
      await performAutoplay(page, step, runtime, log);
      return null;
    case "tutorialBeat":
      await performTutorialBeat(page, step, runtime, log);
      return null;
    case "screenshot":
      return performScreenshot(page, step, runtime);
    default:
      throw new Error(`unsupported action "${step.action}"`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printHelp();
    return;
  }

  if (!args.url) {
    printHelp();
    throw new Error("missing --url");
  }

  const scenarioPath = resolveScenarioPath(args.scenario);
  const scenario = await loadScenario(scenarioPath);
  const options = scenario.options || {};

  const headed = toBoolean(args.headed, false);
  const headless = args.headless !== undefined ? toBoolean(args.headless, !headed) : !headed;

  const runtime = {
    timeoutMs: Math.max(250, toNumber(args.timeout, toNumber(options.timeoutMs, 7000))),
    stepDelayMs: Math.max(0, toNumber(args["step-delay"], toNumber(options.stepDelayMs, 250))),
    slowMoMs: Math.max(0, toNumber(args["slow-mo"], 0)),
    screenshotDir: args["screenshot-dir"]
      ? path.resolve(process.cwd(), args["screenshot-dir"])
      : options.screenshotDir
        ? path.resolve(process.cwd(), options.screenshotDir)
        : path.join(__dirname, "artifacts"),
    failOnConsoleError: toBoolean(
      args["fail-on-console-error"],
      toBoolean(options.failOnConsoleError, true),
    ),
    noFinalScreenshot: toBoolean(args["no-final-screenshot"], false),
  };

  console.log(`[bot] scenario: ${scenario.name || path.basename(scenarioPath)}`);
  console.log(`[bot] url: ${args.url}`);
  console.log(`[bot] headless: ${headless ? "yes" : "no"}`);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed. Run `cd /Users/mstafford/Projects/local/save-the-grid/bot-player && npm install` first.",
    );
  }

  const browser = await chromium.launch({
    headless,
    slowMo: runtime.slowMoMs > 0 ? runtime.slowMoMs : undefined,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(String(args.url), {
    waitUntil: "domcontentloaded",
    timeout: runtime.timeoutMs,
  });

  let completed = 0;

  for (let i = 0; i < scenario.steps.length; i += 1) {
    const step = scenario.steps[i];
    const title = step.name || `${step.action}`;
    const prefix = `[bot] step ${i + 1}/${scenario.steps.length}: ${title}`;
    console.log(prefix);

    try {
      const shotPath = await runStep(page, step, runtime, (line) => console.log(`[bot] ${line}`));
      if (shotPath) {
        console.log(`[bot] screenshot: ${shotPath}`);
      }
      completed += 1;
    } catch (error) {
      if (step.optional) {
        console.warn(`[bot] optional step failed: ${error.message}`);
      } else {
        const shotPath = await takeScreenshot(
          page,
          runtime.screenshotDir,
          `failed-step-${i + 1}-${step.action}`,
          true,
        );
        throw new Error(`failed at step ${i + 1} (${step.action})\n${error.message}\n${shotPath}`);
      }
    }

    if (runtime.stepDelayMs > 0 && step.action !== "wait") {
      await page.waitForTimeout(runtime.stepDelayMs);
    }
  }

  if (!runtime.noFinalScreenshot) {
    const finalShot = await takeScreenshot(page, runtime.screenshotDir, "final", true);
    console.log(`[bot] final screenshot: ${finalShot}`);
  }

  await context.close();
  await browser.close();

  console.log(`[bot] completed steps: ${completed}/${scenario.steps.length}`);
  if (consoleErrors.length > 0) {
    console.log(`[bot] console/page errors captured: ${consoleErrors.length}`);
    for (const errorText of consoleErrors) {
      console.log(`[bot] console-error: ${errorText}`);
    }
    if (runtime.failOnConsoleError) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(`[bot] ${error.message}`);
  process.exitCode = 1;
});
