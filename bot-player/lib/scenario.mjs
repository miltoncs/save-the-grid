import fs from "node:fs/promises";
import { toNumber } from "./cli.mjs";

export async function loadScenario(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) {
    throw new Error(`Invalid scenario file: ${filePath}`);
  }
  return parsed;
}

export function normalizeTargets(step) {
  if (Array.isArray(step.targets) && step.targets.length > 0) {
    return step.targets;
  }
  return [step];
}

export function stepTimeout(step, runtime) {
  const fallback = step.optional ? Math.min(runtime.timeoutMs, 1500) : runtime.timeoutMs;
  return toNumber(step.timeoutMs, fallback);
}

export function buildLocator(page, target) {
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

export function describeTarget(target) {
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
