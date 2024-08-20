//import { Observable, Change } from "@gullerya/object-observer";
import onChange, { ApplyData } from "on-change";
import {
  wrapWithCursorProxy,
  CursorProxy,
  isCursorProxy,
  getCursor,
  getCursorProxyMeta,
  ObjPathProxy,
  getValueUsingPath,
} from "../../utils/index";
import * as Constants from "../constants";
import { sign } from "crypto";

export type { ObjPathProxy } from "../../utils/index";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";

type SignalGetter<T = any> = {
  (arg?: SubToken): T;
  type: typeof Constants.SIGNAL_GETTER;
  sig: Signal<T>;
};
type SignalSetter<T> = (newValue: T) => void;

export type SignalAPI<T = any> = [SignalGetter<T>, SignalSetter<T>];

export type Signal<T = unknown> = SignalAPI & {
  id: string;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  /** To check "if x is a signal" */
  type: typeof Constants.SIGNAL;

  value: T;
  get: SignalGetter<T>;
  set: SignalSetter<T>;
};

export type ExtractElement<ArrayType extends ArrayOrObject> =
  ArrayType extends readonly (infer ElementType)[]
    ? ElementType
    : ArrayType extends { [key: string]: infer ElementType2 }
    ? ElementType2
    : never;

export type ArrayOrObject = Array<unknown> | Record<string, unknown>;

export type StoreCursor<T = unknown, TRoot = T> = T extends ArrayOrObject
  ? {
      [P in keyof T]: T[P];
    }
  : T;

type extractGeneric<Type> = Type extends ObjPathProxy<unknown, infer X>
  ? X
  : Type extends StoreCursor<infer X>
  ? X
  : never;

export type StoreManager<T = unknown> = {
  id: string;
  value: T;
  rootCursor?: StoreCursor;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  type: typeof Constants.STORE;
  tasks: Set<{
    path: string[];
    observor: (change: StoreChange) => void;
  }>;
  get: (cursor: StoreCursor, wire: Wire) => any;
  unsubscribe: Function;
};

export type StoreChangeData = ApplyData;

export type StoreChange = {
  path: string[];
  data: StoreChangeData;
  value: any;
};

/** 3 bits: [RUNNING][SKIP_RUN_QUEUE][NEEDS_RUN] */
type WireState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const S_RUNNING = 0b100 as const;
const S_SKIP_RUN_QUEUE = 0b010 as const;
const S_NEEDS_RUN = 0b001;

export type Wire<T = unknown> = {
  id: string;
  type: typeof Constants.WIRE;

  fn: WireFunction<T> | StoreCursor;
  // FSM state 3-bit bitmask: [RUNNING][SKIP_RUN_QUEUE][NEEDS_RUN]
  state: WireState;
  runCount: number;
  value?: T;

  // Run the wire
  run: () => T;

  // Signals/Stores read-subscribed last run
  sigRS: Set<Signal>;
  storesRS: WeakMap<StoreManager, Set<string>>;

  // Post-run tasks
  tasks: Set<(nextValue: T) => void>;

  // Wire that created this wire (parent of this child)
  upper: Wire | undefined;
  // Wires created during this run (children of this parent)
  lower: Set<Wire>;

  token: SubToken;
  subWire: WireFactory;
};

export type WireFactory<T = any> = (
  arg: WireFunction<T> | Signal<T> | StoreCursor
) => Wire<T>;

export type WireFunction<T = unknown> = {
  (
    $: SubToken,
    params: { createWire: WireFactory; wire: WireFactory; previousValue?: T }
  ): T;
};

export type SubToken = {
  <T = unknown>(sig: Signal<T> | T): T;
  wire: Wire<any>;
  type: typeof Constants.SUBTOKEN;
};

let SIGNAL_COUNTER = 0;
let WIRE_COUNTER = 0;
let STORE_COUNTER = 0;

export const isWire = (arg: any): arg is Wire => {
  return (arg as Wire).type === Constants.WIRE;
};

export const isSignal = (arg: any): arg is Signal => {
  return (arg as Signal).type === Constants.SIGNAL;
};

export const isSignalGetter = (arg: any): arg is SignalGetter => {
  return (arg as SignalGetter).type === Constants.SIGNAL_GETTER;
};

export const isStoreCursor = (
  arg: any
): arg is ObjPathProxy<unknown, unknown> => {
  return Boolean(isCursorProxy(arg));
};

export const createSignal = <T = any>(val: T): Signal<T> => {
  SIGNAL_COUNTER++;
  function get(token?: SubToken) {
    if (token) {
      // Two-way link. Signal writes will now call/update wire W
      token.wire.sigRS.add(sig);
      sig.wires.add(token.wire);
      return sig.value as T;
    } else {
      return sig.value as T;
    }
  }

  function set(value: T) {
    sig.value = value;
    runWires(sig.wires);
    return val;
  }

  const sig: any = [get, set];
  sig.id = "signal|" + SIGNAL_COUNTER;
  sig.type = Constants.SIGNAL;
  sig.value = val;
  sig.wires = new Set<Wire>();

  sig.get = get;
  sig.set = set;

  return sig;
};

export const createComputedSignal = <T = any>(wire: Wire<T>) => {
  const value = wire.run();
  const signal = createSignal<T>(value);
  const handler = () => {
    signal.set(wire.value as T);
  };
  wire.tasks.add(handler);
  return signal;
};

export const createWire: WireFactory = (
  arg: WireFunction | StoreCursor
): Wire => {
  WIRE_COUNTER++;
  const wire: Wire = {
    id: "wire|" + WIRE_COUNTER,
    type: Constants.WIRE,
    fn: arg,
    sigRS: new Set(),
    storesRS: new WeakMap(),
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
    subWire: (subFn: WireFunction | StoreCursor) => {
      const subWire = createWire(subFn);
      subWire.upper = wire;
      wire.lower.add(subWire);
      return subWire;
    },
    token: undefined as any,
  };
  wire.token = getSubtoken(() => wire);
  return wire;
};

const getSubtoken = (fn: () => Wire): SubToken => {
  const wire = fn();
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
      const v = manager.get(cursor, wire);
      wire.value = v;
      return v;
    }
  };
  token.wire = wire;
  token.type = Constants.SUBTOKEN;
  return token;
};

const runWire = (
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
  wire.storesRS = new WeakMap();
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

const runWires = (wires: Set<Wire<any>>): void => {
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

const handleStoreChange = (
  manager: StoreManager,
  p: (string | symbol)[],
  value: any,
  previousValue: any,
  change: ApplyData
) => {
  const changePath = p as string[];
  const toRun = new Set<Wire>();
  // todo: improve this logic
  for (const wire of manager.wires) {
    const cursors = wire.storesRS.get(manager);
    if (cursors) {
      for (var cursorStr of cursors) {
        let match: boolean | undefined;
        const cursor = cursorStr === "" ? [] : decodeCursor(cursorStr);
        if (change === undefined) {
          match =
            cursor.length <= changePath.length
              ? encodeCursor(changePath.slice(0, cursor.length)) == cursorStr
              : true;
        } else if (
          change &&
          ["splice", "push", "pop"].indexOf(change.name) > -1
        ) {
          match = encodeCursor(changePath.slice(0, cursor.length)) == cursorStr;
        }
        if (match) toRun.add(wire);
      }
    }
  }

  runWires(toRun);

  [...manager.tasks].forEach(({ path, observor }) => {
    if (changePath.slice(0, path.length).join("/") === path.join("/")) {
      observor({ data: change, path: changePath, value });
    }
  });
};

export const createStore = <T = unknown>(
  obj: T
): StoreCursor<T, StoreManager<T>> => {
  const observedObject = onChange(
    obj as Record<any, any>,
    (p, v, pv, data) => handleStoreChange(manager, p, v, pv, data),
    {
      pathAsArray: true,
    }
  );
  STORE_COUNTER++;
  const manager: StoreManager<T> = {
    id: "store|" + STORE_COUNTER,
    value: observedObject,
    wires: new Set<Wire>(),
    type: Constants.STORE,
    tasks: new Set(),
    unsubscribe: () => {
      onChange.unsubscribe(observedObject);
    },
    get: (cursor: StoreCursor, wire: Wire) => {
      const cursorPath = getCursor(cursor);
      const encodedCursor = encodeCursor(cursorPath);
      manager.wires.add(wire);
      if (wire.storesRS.has(manager)) {
        wire.storesRS.get(manager)?.add(encodedCursor);
      } else {
        const set = new Set<string>();
        set.add(encodedCursor);
        wire.storesRS.set(manager, set);
      }
      const v = getValueUsingPath(manager.value as any, cursorPath);
      return v;
    },
  };

  const s = wrapWithCursorProxy<T, StoreManager<T>>(observedObject, manager);

  return s as StoreCursor<T>;
};

export const reify = <T = unknown>(cursor: T): T => {
  const s = cursor as unknown as StoreCursor;
  const manager: StoreManager = getCursorProxyMeta<StoreManager>(
    s as unknown as ObjPathProxy<unknown, unknown>
  );
  const cursorPath = getCursor(s);
  const v = getValueUsingPath(manager.value as any, cursorPath);
  return v as T;
};

export const produce = <T = unknown>(
  cursor: T,
  setter: (obj: T) => void
): void => {
  const v = reify(cursor);
  setter(v);
};

//
const encodeCursor = (cursor: string[]) =>
  cursor.map(encodeURIComponent).join("/");
const decodeCursor = (str: string) => str.split("/").map(decodeURIComponent);

//
// Function to adjust cursor paths for array changes
function adjustCursorForArrayChange(cursor: string[], change: any): string[] {
  const newCursor = [...cursor];
  const index = parseInt(change.path[change.path.length - 1], 10);

  switch (change.type) {
    case "insert":
      if (index <= cursor.length) {
        newCursor.push(String(index));
      }
      break;
    case "delete":
      if (index < cursor.length) {
        newCursor.splice(index, 1);
      }
      break;
    case "splice":
      const { index: spliceIndex, removed, added } = change;
      if (spliceIndex <= cursor.length) {
        newCursor.splice(
          spliceIndex,
          removed.length,
          ...added.map((_: any, i: any) => String(spliceIndex + i))
        );
      }
      break;
  }

  return newCursor;
}

export const applyStoreChange = (store: CursorProxy, change: StoreChange) => {
  if (change.data) {
    produce(getValueUsingPath(store, change.path), (state) => {
      (state as any)[change.data.name].apply(state, change.data.args);
    });
  } else {
    if (change.path.length === 0) {
      produce(store, (s) => {
        const v = change.value || {};
        Object.keys(v).forEach((k) => {
          (s as any)[k] = v[k];
        });
      });
    } else {
      const tail = change.path[change.path.length - 1];
      produce(
        getValueUsingPath(store, change.path.slice(0, change.path.length - 1)),
        (state) => {
          state[tail] = change.value;
        }
      );
    }
  }
};
