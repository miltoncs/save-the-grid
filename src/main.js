import { SaveTheGridApp } from "./game.js";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("#app mount point not found");
}

new SaveTheGridApp(root);
