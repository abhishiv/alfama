import onChange from "on-change";
import {
  CursorProxy,
  getCursor,
  getCursorProxyMeta,
  getValueUsingPath,
  ObjPathProxy,
  wrapWithCursorProxy,
} from "../../utils/index";
import { createStoreManager, handleStoreChange } from "./store";
import { StoreChange, StoreCursor, StoreManager } from "./types";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";
export type { ObjPathProxy } from "../../utils/index";

let STORE_COUNTER = 0;

export const createStore = <T = unknown>(
  obj: T
): StoreCursor<T, StoreManager<T>> => {
  const observedObject = onChange(
    obj as Record<any, any>,
    (p, v, pv, data) => handleStoreChange(manager, p, v, pv, data),
    {
      pathAsArray: true,
      ignoreDetached: true,
    }
  );
  STORE_COUNTER++;
  const manager = createStoreManager(STORE_COUNTER, observedObject);

  const s = wrapWithCursorProxy<T, StoreManager<T>>(observedObject, manager);

  return s as StoreCursor<T>;
};

export const reify = <T = unknown>(cursor: T): T => {
  const s = cursor as unknown as StoreCursor;
  const manager: StoreManager = getCursorProxyMeta<StoreManager>(
    s as unknown as ObjPathProxy<unknown, unknown>
  );
  if (manager) {
    const cursorPath = getCursor(s);
    const v = getValueUsingPath(manager.value as any, cursorPath);
    return v as T;
  } else {
    return cursor;
  }
};

export const produce = <T = unknown>(
  cursor: T,
  setter: (obj: T) => void,
  fv?: any
): void => {
  const v = fv ? fv : reify(cursor);
  setter(v);
};

// Apply changes to the store based on the cursor and change object
export const applyStoreChange = (store: CursorProxy, change: StoreChange) => {
  if (change.data) {
    applyDataChange(store, change);
  } else {
    applyValueChange(store, change);
  }
};

// Apply a change that uses a data operation (e.g., array operations)
function applyDataChange(store: CursorProxy, change: StoreChange) {
  const target = getValueUsingPath(store, change.path);
  produce(target, (state) => {
    (state as any)[change.data.name].apply(state, change.data.args);
  });
}

// Apply a direct value change to the store
function applyValueChange(store: CursorProxy, change: StoreChange) {
  if (change.path.length === 0) {
    produce(store, (state) => {
      const newValue = change.value || {};
      Object.keys(newValue).forEach((key) => {
        (state as any)[key] = newValue[key];
      });
    });
  } else {
    const tailKey = change.path[change.path.length - 1];
    const target = getValueUsingPath(
      store,
      change.path.slice(0, change.path.length - 1)
    );
    produce(target, (state) => {
      state[tailKey] = change.value;
    });
  }
}
