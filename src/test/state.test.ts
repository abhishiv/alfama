import { assert, expect, test } from "vitest";
import { signal } from "../index";

import { Observer, ChangeReport } from "../experimental/observer";

test("Signal", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});

test("Wire", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});

test("Observer", () => {
  let data = { b: 0, list: [1, 2, 3], nested: { prop: "value" } };

  let proxy = Observer.create(data, (change: ChangeReport) => {
    console.log(JSON.stringify(change));
    return true;
  });

  //console.log(proxy.b);

  proxy.list = [...proxy.list];
});
