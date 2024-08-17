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
import { EnumDeclaration, EnumMember, EnumType } from "typescript";

export type { ObjPathProxy } from "../../utils/index";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";

export type Signal<T = unknown> = {
  id: string;
  (): T;
  /** Write value; notifying wires */
  // Ordered before ($):T for TS to work
  (value: T): void;
  /** Read value & subscribe */
  ($: SubToken): T;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  /** To check "if x is a signal" */
  type: typeof Constants.SIGNAL;

  value: T;
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
  rootCursor: StoreCursor;
  /** Wires subscribed to this signal */
  wires: Set<Wire<any>>;
  type: typeof Constants.STORE;
  tasks: Set<{
    path: string[];
    observor: (change: StoreChange) => void;
  }>;
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

export type Wire<T = unknown> = {
  id: string;
  /** Run the wire */
  run: () => T;
  (token: SubToken): T;
  fn: WireFunction<T>; //| StoreCursor;
  /** Signals read-subscribed last run */
  sigRS: Set<Signal>;
  wiresRS: Set<Wire>;
  storesRS: WeakMap<StoreManager, Set<string>>;
  /** Post-run tasks */
  tasks: Set<(nextValue: T) => void>;
  /** Wire that created this wire (parent of this child) */
  upper: Wire | undefined;
  /** Wires created during this run (children of this parent) */
  lower: Set<Wire>;
  /** FSM state 3-bit bitmask: [RUNNING][SKIP_RUN_QUEUE][NEEDS_RUN] */
  /** Run count */
  runCount: number;
  value?: T;
  /** To check "if x is a wire" */
  type: typeof Constants.WIRE;
  token: SubToken;
  subWire: WireFactory;
  state: WireState;
};

export type SubToken = {
  /** Allow $(...signals) to return an array of read values */
  <T = unknown>(sig: Signal<T> | T): T;
  /** Wire to subscribe to */
  wire: Wire<any>;
  /** To check "if x is a subscription token" */
  type: typeof Constants.SUBTOKEN;
};

export type WireFunction<T = unknown> = {
  ($: SubToken, params: { wire: WireFactory; previousValue?: T }): T;
};

export type WireFactory<T = any> = (
  arg: WireFunction<T> | Signal<T> //| StoreCursor
) => Wire<T>;

// Symbol() doesn't gzip well. `[] as const` gzips best but isn't debuggable
// without a lookup Map<> and other hacks.
const S_RUNNING = 0b100;
const S_SKIP_RUN_QUEUE = 0b010;
const S_NEEDS_RUN = 0b001;

let SIGNAL_COUNTER = 0;
let WIRE_COUNTER = 0;
let STORE_COUNTER = 0;

export const createWire: WireFactory = (arg) => {
  const w: Partial<Wire> = (token: SubToken) => {
    // todo wires should be rs to other wires
  };
  const subWireFactory: WireFactory = (subFn) => {
    const subWire = createWire(subFn);
    subWire.upper = w as Wire;
    (w as Wire).lower.add(subWire);
    return subWire;
  };
  const $: SubToken = getSubtoken(w as Wire);
  WIRE_COUNTER++;
  w.id = "wire|" + WIRE_COUNTER;
  w.sigRS = new Set();
  w.wiresRS = new Set();
  w.storesRS = new WeakMap();
  w.tasks = new Set();
  w.lower = new Set();
  w.runCount = 0;
  w.run = () => {
    const val = runWire(arg, $, subWireFactory);
    // Clean up unused nested wires
    return val;
  };
  w.type = Constants.WIRE;
  w.fn = arg;
  w.token = $;
  w.subWire = subWireFactory;
  return w as Wire;
};

const runWire = (
  arg: WireFunction | Signal | StoreCursor,
  token: SubToken,
  subWireFactory: WireFactory
) => {
  if (isCursorProxy(arg)) {
    const cursor = arg as StoreCursor;
    const v = token(cursor);
    token.wire.value = v;
    //console.log("vvv", value, cursor);
    //    debugger;
    return v;
  } else if ((arg as Signal).type === Constants.SIGNAL) {
    const sig = arg as Signal;
    const v = token(sig);
    token.wire.value = v;
    return v;
  } else {
    const fn = arg as WireFunction;
    const v = fn(token, {
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
};

/**
 * Pauses a wire so signal writes won't cause runs. Affects nested wires */
const wirePause = (wire: Wire): void => {
  wire.lower.forEach(wirePause);
  wire.state |= S_SKIP_RUN_QUEUE;
};

/**
 * Resumes a paused wire. Affects nested wires but skips wires belonging to
 * computed-signals. Returns true if any runs were missed during the pause */
const wireResume = (wire: Wire): boolean => {
  wire.lower.forEach(wireResume);
  // Clears SKIP_RUN_QUEUE only if it's NOT a computed-signal
  // if (!wire.cs)
  wire.state &= ~S_SKIP_RUN_QUEUE;
  return !!(wire.state & S_NEEDS_RUN);
};

const _runWires = (wires: Set<Wire<any>>): void => {
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

export const createSignal = <T = any>(val: T): Signal<T> => {
  const s: Partial<Signal> = function (arg?: T) {
    const sig = s as Signal;
    if (arguments.length == 0) {
      return s.value;
    } else if (
      arg &&
      (arg as unknown as SubToken).type === Constants.SUBTOKEN
    ) {
      const token = arg as unknown as SubToken;
      // Two-way link. Signal writes will now call/update wire W
      token.wire.sigRS.add(sig);
      sig.wires.add(token.wire);
      return s.value;
    } else {
      s.value = arg;
      _runWires(sig.wires);
      return val;
    }
  };
  SIGNAL_COUNTER++;
  s.id = "signal|" + SIGNAL_COUNTER;
  s.value = val;
  s.wires = new Set<Wire>();
  s.type = Constants.SIGNAL;
  return s as Signal<T>;
};
// just to make api similar to haptic
createSignal.anon = createSignal;

export const createStore = <T = unknown>(
  obj: T
): StoreCursor<T, StoreManager<T>> => {
  const storeManager: Partial<StoreManager<T>> = {
    wires: new Set<Wire>(),
    type: Constants.STORE,
    tasks: new Set(),
    unsubscribe: () => {
      onChange.unsubscribe(observedObject);
    },
  };
  const observedObject = onChange(
    obj as Record<any, any>,
    (p, value, previousValue, change) => {
      const changePath = p as string[];
      const toRun = new Set<Wire>();
      // todo: improve this logic
      const manager = storeManager as StoreManager;
      for (const wire of manager.wires) {
        const cursors = wire.storesRS.get(manager);
        if (cursors) {
          for (var cursorStr of cursors) {
            let match: boolean | undefined;
            const cursor = cursorStr === "" ? [] : decodeCursor(cursorStr);
            if (change === undefined) {
              match =
                cursor.length <= changePath.length
                  ? encodeCursor(changePath.slice(0, cursor.length)) ==
                    cursorStr
                  : true;
            } else if (
              change &&
              ["splice", "push", "pop"].indexOf(change.name) > -1
            ) {
              match =
                encodeCursor(changePath.slice(0, cursor.length)) == cursorStr;
              // todo: adjust cursors to handle this case
              //switch (change.name) {
              //  case 'insert':
              //  case 'delete':
              //  case 'splice':
              //    manager.wires.forEach(wire => {
              //      const cursors = wire.storesRS.get(manager);
              //      if (cursors) {
              //        const updatedCursors = new Set<string>();
              //        cursors.forEach(cursorStr => {
              //          const cursor = decodeCursor(cursorStr);
              //          // Adjust the cursor path based on the array operation
              //          // Example: If an element is inserted at index 2, increment indices >= 2
              //          const updatedCursor = adjustCursorForArrayChange(cursor, change);
              //          updatedCursors.add(encodeCursor(updatedCursor));
              //        });
              //        wire.storesRS.set(manager, updatedCursors);
              //      }
              //    });
              //    break;
              //}
            }
            if (match) toRun.add(wire);
          }
        }
      }

      _runWires(toRun);

      [...manager.tasks].forEach(({ path, observor }) => {
        if (changePath.slice(0, path.length).join("/") === path.join("/")) {
          observor({ data: change, path: changePath, value });
        }
      });
    },
    { pathAsArray: true }
  );

  const s = wrapWithCursorProxy<T, StoreManager<T>>(
    observedObject,
    storeManager
  );

  storeManager.value = observedObject;
  STORE_COUNTER++;
  storeManager.id = "store|" + STORE_COUNTER;

  return s as StoreCursor<T>;
};

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

export const reify = <T = unknown>(cursor: T): T => {
  const s = cursor as unknown as StoreCursor;
  const manager: StoreManager = getCursorProxyMeta<StoreManager>(
    s as unknown as ObjPathProxy<unknown, unknown>
  );
  const cursorPath = getCursor(s);
  //  console.log({ cursorPath, manager });
  //console.log(JSON.stringify(manager.value));
  const v = getValueUsingPath(manager.value as any, cursorPath);
  //console.log({ v: JSON.stringify(v), cursorPath });
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

// todo: figure how to annotate values from store.cursor with Symbol
const getSubtoken = (wire: Wire): SubToken => {
  const token: Partial<SubToken> = (arg: Signal | StoreCursor) => {
    //console.log("arg", arg);
    if (isCursorProxy(arg)) {
      const cursor = arg as StoreCursor;
      const cursorPath = getCursor(cursor);
      // todo: improve ts here and remove typecast
      const manager = getCursorProxyMeta<StoreManager>(
        cursor as unknown as ObjPathProxy<unknown, unknown>
      );

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
      //console.log("v", v);
      wire.value = v;
      return v;
    } else {
      const sig = arg as Signal;
      const v = sig(token);
      wire.value = v;
      return v;
    }
  };
  token.wire = wire;
  token.type = Constants.SUBTOKEN;
  return token as SubToken;
};

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
