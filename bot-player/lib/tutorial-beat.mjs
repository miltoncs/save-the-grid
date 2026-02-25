import { toNumber } from "./cli.mjs";

async function advanceTimeWithHook(page, ms, runtime) {
  const usedHook = await page.evaluate((timeMs) => {
    if (typeof window.advanceTime === "function") {
      window.advanceTime(timeMs);
      return true;
    }
    return false;
  }, ms);

  if (!usedHook) {
    await page.waitForTimeout(Math.max(0, ms || runtime.stepDelayMs || 0));
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

export async function performTutorialBeat(page, step, runtime, log) {
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
          await advanceTimeWithHook(page, settleMs * 2, runtime);
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
      await advanceTimeWithHook(page, settleMs, runtime);
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
