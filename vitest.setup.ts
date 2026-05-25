import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `globals: false` is set in vitest.config.ts, so RTL's automatic
// afterEach(cleanup) does not register itself. Wire it up explicitly
// so component tests don't leak DOM nodes into their successors.
afterEach(() => {
  cleanup();
});
