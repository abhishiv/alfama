import { assert, expect, test, describe, vi } from "vitest";
import { createSignal, createWire, createStore, reify, produce } from "./state";

describe("Basic Implementation of Signals & Wires", (test) => {
  test("Signal", () => {
    const val = 1;
    const sig = createSignal(val);
    expect(sig).toBeDefined();
    expect(sig()).toBe(val);
  });

  test("Wire", () => {
    const sig = createSignal(2);
    const w = createWire(($, wire) => {
      const val = $(sig);
      return val;
    });
    expect(w()).toBe(sig());
  });
});

describe("Nested Signals & Wires", (test) => {
  test("Nested Wires should cleanup and not fire multiple times in case of nested wires", () => {
    const c = { log: (...v: any[]) => console.log(...v) };
    const lSpy = vi.spyOn(c, "log");
    const sig = createSignal(1);
    const w = createWire(($, wire) => {
      const val = $(sig);
      console.log("count", val);

      const b = wire(($, wire) => {
        const doubleCount = sig($) * 2;
        c.log("doublecount", doubleCount);
        return val;
      });
      b();
      return val;
    });
    w();
    sig(4);
    expect(lSpy.mock.calls.length).toBe(2);
  });
});

describe("Basic Implementation of Stores & Wires", (test) => {
  // test that wire only runs when subscribed cursors are updated
  test("Wire", () => {
    const c = { log: (...v: any[]) => console.log(...v) };
    const lSpy = vi.spyOn(c, "log");
    const val: { list: number[]; friends: { id: string; name: string }[] } = {
      list: [1, 2, 3],
      friends: [{ id: "2", name: "" }],
    };
    const s = createStore(val);

    const w = createWire(($, wire) => {
      const v = $(s.friends[0].id);

      c.log(JSON.stringify(v));
      return v;
    });
    w();
    // ignored since cursor is at  $(s.friends[0].id)
    produce(s.friends, (obj) => {
      obj.push({ id: "2", name: "" });
    });
    produce(s.friends, (obj) => {
      obj[0].id = "33";
    });

    expect(lSpy.mock.calls.length).toBe(2);
  });
  // test that wire only runs when subscribed cursors are updated
  test("Wire at store root", () => {
    const c = { log: (...v: any[]) => console.log(...v) };
    const lSpy = vi.spyOn(c, "log");
    const val: { list: number[] } = {
      list: [1, 2, 3],
    };
    const s = createStore(val);

    const w = createWire(($, wire) => {
      const v = $(s);
      c.log("log", JSON.stringify(v));
      return v;
    });
    w();

    produce(s, (obj) => {
      obj.list = [];
    });
    produce(s, (obj) => {
      obj.list = [2];
    });

    expect(lSpy.mock.calls.length).toBe(3);
  });
});
