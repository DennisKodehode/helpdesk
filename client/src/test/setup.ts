import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { installMatchMediaMock, resetTestViewport } from "./matchMedia";

// jsdom lacks matchMedia; install a controllable mock so the responsive layout
// hook works under tests. Defaults to a desktop viewport; per-test resizes via
// setTestViewportWidth().
installMatchMediaMock();
afterEach(resetTestViewport);
