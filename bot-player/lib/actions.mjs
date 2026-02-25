import fs from "node:fs/promises";
import path from "node:path";
import { slugify, toNumber } from "./cli.mjs";
import { buildLocator, describeTarget, normalizeTargets, stepTimeout } from "./scenario.mjs";
import { performTutorialBeat } from "./tutorial-beat.mjs";

export async function takeScreenshot(page, screenshotDir, name, fullPage = false) {
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

export async function performAdvanceTime(page, step, runtime) {
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

export async function runStep(page, step, runtime, log) {
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
