import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const repository = fileURLToPath(new URL("../../", import.meta.url));
const vision = `${frontend}node_modules/@mediapipe/tasks-vision/wasm`;

await mkdir(`${frontend}public/wasm`, { recursive: true });
await mkdir(`${frontend}public/models`, { recursive: true });
await cp(vision, `${frontend}public/wasm`, { recursive: true });
await cp(
  `${repository}models/pose_landmarker_lite.task`,
  `${frontend}public/models/pose_landmarker_lite.task`,
);
console.log("Copied local MediaPipe model and WebAssembly assets.");

