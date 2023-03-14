import { assert, expect, test } from "vitest";
import { signal, wire } from "../experimental/state";
import { Observer } from "../experimental/observer";

test("Signal", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});

test("Wire", () => {
  const sig = signal.anon(1);
  const w = wire(($: any) => {
    const val = sig($);
    console.log(val);
  });
  w();
  expect(sig).toBeDefined();
});

test("Observer", () => {
  let data = { b: 0, list: [1, 2, 3], nested: { prop: "value" } };

  let proxy = Observer.create(data, (change) => {
    return true;
  });
  proxy.list = [...proxy.list];
});
