/// <reference lib="webworker" />
/**
 * The WebGL stage, off the main thread. Rendering, three.js parsing, model decoding,
 * geometry baking and shader compilation all happen here, so scrolling and input on the
 * page are never blocked by the 3D scene.
 *
 * Import order matters: the shims must evaluate before the scene's libraries.
 */
import "./stageWorkerShims";
import { startStage } from "./stageWorkerEntry";

startStage();
