import { assert, expect, test } from "vitest";
import { signal } from "../index";

test("Signal", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});

test("Wire", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});
