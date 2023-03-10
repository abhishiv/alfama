import { assert, expect, test } from "vitest";
import { signal } from "../index";

import { Observer, ChangeReport } from "../proxy-observer";

let data = { b: 0, list: [1, 2, 3], nested: { prop: "value" } };

let proxy = Observer.create(data, (change: ChangeReport) => {
  console.log(JSON.stringify(change));
  return true;
});

proxy.nested["prop"] = "s";
proxy.list.push(5);
proxy.b++;
test("Signal", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});

test("Wire", () => {
  const sig = signal.anon(1);
  expect(sig).toBeDefined();
});
