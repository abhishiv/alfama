import { getCursorProxyMeta } from "../../utils/index";
import * as Constants from "../constants";
import {
  Signal,
  SignalGetter,
  StoreCursor,
  StoreManager,
  SubToken,
  Wire,
  WireFactory,
  WireFunction,
} from "./types";
import { isSignal, isSignalGetter, isStoreCursor } from "./utils";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";
export type { ObjPathProxy } from "../../utils/index";

let WIRE_COUNTER = 0;

const S_RUNNING = 0b100 as const;
const S_SKIP_RUN_QUEUE = 0b010 as const;
const S_NEEDS_RUN = 0b001 as const;

export const createWire: WireFactory = (arg: WireFunction): Wire => {
  WIRE_COUNTER++;
  const wire: Wire = Object.assign(() => {}, {
    id: "wire|" + WIRE_COUNTER,
    type: Constants.WIRE,
    fn: arg,
    sigRS: new Set(),
    storesRS: new Map(),
    tasks: new Set(),
    state: S_NEEDS_RUN,
    upper: undefined,
    lower: new Set(),
    runCount: 0,
    run: () => {
      const val = runWire(arg, wire.token, wire.subWire);
      // Clean up unused nested wires
      return val;
    },
    subWire: (subFn: WireFunction) => {
      const subWire = createWire(subFn);
      subWire.upper = wire;
      wire.lower.add(subWire);
      return subWire;
    },
    token: undefined as any,
  } as Wire);
  wire.token = getSubtoken(wire);
  return wire;
};

const getSubtoken = (wire: Wire): SubToken => {
  const token: SubToken = (arg: Signal | StoreCursor | SignalGetter) => {
    if (isSignal(arg)) {
      const v = arg.get(token);
      wire.value = v;
      return v;
    } else if (isSignalGetter(arg)) {
      const sig = arg.sig;
      const v = sig.get(token);
      wire.value = v;
      return v;
    } else if (isStoreCursor(arg)) {
      const cursor = arg;
      const manager = getCursorProxyMeta<StoreManager>(cursor);
      const v = manager.get(cursor, token);
      wire.value = v;
      return v;
    }
  };
  token.wire = wire;
  token.type = Constants.SUBTOKEN;
  return token;
};

export const runWire = (
  arg: WireFunction | Signal | StoreCursor | SignalGetter,
  token: SubToken,
  subWireFactory: WireFactory
) => {
  if (isStoreCursor(arg)) {
    const cursor = arg;
    const v = token(cursor);
    token.wire.value = v;
    return v;
  } else if (isSignal(arg)) {
    const sig = arg;
    const v = token(sig);
    token.wire.value = v;
    return v;
  } else if (isSignalGetter(arg)) {
    const sig = arg.sig;
    const v = token(sig);
    token.wire.value = v;
    return v;
  } else {
    const fn = arg as WireFunction;
    const v = fn(token, {
      createWire: subWireFactory,
      wire: subWireFactory,
      previousValue: token.wire.value,
    });
    token.wire.value = v;
    return v;
  }
};

const wireReset = (wire: Wire<any>): void => {
  wire.lower.forEach(wireReset);
  wire.sigRS.forEach((signal) => signal.wires.delete(wire));
  _initWire(wire);
};

const _initWire = (wire: Wire<any>): void => {
  wire.state = S_NEEDS_RUN;
  wire.lower = new Set();
  // Drop all signals now that they have been unlinked
  wire.sigRS = new Set();
  wire.storesRS = new Map();
};

// Pauses a wire so signal writes won't cause runs. Affects nested wires
const wirePause = (wire: Wire): void => {
  wire.lower.forEach(wirePause);
  wire.state |= S_SKIP_RUN_QUEUE;
};

// Resumes a paused wire. Affects nested wires but skips wires belonging to computed-signals. Returns true if any runs were missed during the pause
const wireResume = (wire: Wire): boolean => {
  wire.lower.forEach(wireResume);
  wire.state &= ~S_SKIP_RUN_QUEUE;
  return !!(wire.state & S_NEEDS_RUN);
};

export const runWires = (wires: Set<Wire<any>>): void => {
  // Use a new Set() to avoid infinite loops caused by wires writing to signals
  // during their run.
  const toRun = new Set(wires);
  let curr: Wire<any> | undefined;
  // Mark upstream computeds as stale. Must be in an isolated for-loop
  toRun.forEach((wire) => {
    if (wire.state & S_SKIP_RUN_QUEUE) {
      toRun.delete(wire);
      wire.state |= S_NEEDS_RUN;
    }
    // TODO: Test (#3) + Benchmark with main branch
    // If a wire's ancestor will run it'll destroy its lower wires. It's more
    // efficient to not call them at all by deleting from the run list:
    curr = wire;
    while ((curr = curr.upper)) if (toRun.has(curr)) return toRun.delete(wire);
  });
  toRun.forEach((wire) => {
    const previousValue = wire.value;
    const val = runWire(wire.fn, wire.token, wire.subWire);

    wire.runCount = wire.runCount + 1;
    if (val === previousValue) return;

    wire.value = val;
    for (const task of wire.tasks) {
      task(val);
    }
  });
};
