import onChange, { ApplyData } from "on-change";
import {
  CursorProxy,
  getCursor,
  getCursorProxyMeta,
  getValueUsingPath,
  ObjPathProxy,
  wrapWithCursorProxy,
} from "../../utils/index";
import * as Constants from "../constants";
import { StoreChange, StoreCursor, StoreManager, Wire } from "./types";
import { runWires } from "./wire";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";
export type { ObjPathProxy } from "../../utils/index";

let STORE_COUNTER = 0;

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
