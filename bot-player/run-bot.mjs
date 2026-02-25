#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import {
  parseArgs,
  printHelp,
  resolveScenarioPath,
  resolveScreenshotDir,
  toBoolean,
  toNumber,
} from "./lib/cli.mjs";
import { loadScenario } from "./lib/scenario.mjs";
import { runStep, takeScreenshot } from "./lib/actions.mjs";

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
      ? resolveScreenshotDir(args["screenshot-dir"])
      : options.screenshotDir
        ? resolveScreenshotDir(options.screenshotDir)
        : resolveScreenshotDir(null),
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
    throw new Error("Playwright is not installed. Run `npm install` in bot-player first.");
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
