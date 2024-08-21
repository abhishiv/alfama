import onChange, { ApplyData } from "on-change";
import { getCursor, getValueUsingPath } from "../../utils/index";
import * as Constants from "../constants";
import { StoreCursor, StoreManager, SubToken, Wire } from "./types";
import { runWires } from "./wire";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";
export type { ObjPathProxy } from "../../utils/index";

const encodeCursor = (cursor: string[]) =>
  cursor.map(encodeURIComponent).join("/");
const decodeCursor = (str: string) => str.split("/").map(decodeURIComponent);

// Create the store manager with essential functionalities
export function createStoreManager<T>(
  id: number,
  observedObject: Record<any, any>
): StoreManager<T> {
  const manager: StoreManager<T> = {
    id: "store|" + id,
    value: observedObject,
    wires: new Set<Wire>(),
    type: Constants.STORE,
    tasks: new Set(),
    unsubscribe: () => {
      onChange.unsubscribe(observedObject);
    },
    get: (cursor: StoreCursor, token: SubToken) =>
      createStoreSubscription(manager, cursor, token.wire),
  };
  return manager;
}

// Get the value from the store based on a cursor path
function createStoreSubscription<T>(
  manager: StoreManager,
  cursor: StoreCursor,
  wire: Wire
): any {
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
}

// Handle changes in the store and trigger associated tasks and wires
export function handleStoreChange(
  manager: StoreManager,
  path: (string | symbol)[],
  newValue: any,
  oldValue: any,
  changeData: ApplyData
) {
  const changePath = path as string[];
  const wiresToRun = findMatchingWires(manager, changePath, changeData);

  runWires(wiresToRun);

  triggerStoreTasks(manager, changePath, newValue, changeData);
}

// Find wires that match the change path
function findMatchingWires(
  manager: StoreManager,
  changePath: string[],
  changeData: ApplyData
): Set<Wire> {
  const matchingWires = new Set<Wire>();

  manager.wires.forEach((wire) => {
    const cursors = wire.storesRS.get(manager);
    if (!cursors) return;

    for (const cursorStr of cursors) {
      const cursor = cursorStr === "" ? [] : decodeCursor(cursorStr);
      const isMatch = matchCursorToChange(cursor, changePath, changeData);

      if (isMatch) {
        matchingWires.add(wire);
      }
    }
  });

  return matchingWires;
}

// Determine if a cursor matches the change path
function matchCursorToChange(
  cursor: string[],
  changePath: string[],
  changeData: ApplyData
): boolean {
  if (changeData === undefined) {
    return cursor.length <= changePath.length
      ? encodeCursor(changePath.slice(0, cursor.length)) == cursor.join("/")
      : true;
  }

  if (["splice", "push", "pop"].includes(changeData.name)) {
    return encodeCursor(changePath.slice(0, cursor.length)) == cursor.join("/");
  }

  return false;
}

// Trigger tasks based on the change path
function triggerStoreTasks(
  manager: StoreManager,
  changePath: string[],
  newValue: any,
  changeData: ApplyData
) {
  manager.tasks.forEach(({ path, observor }) => {
    const isPathMatching =
      changePath.slice(0, path.length).join("/") === path.join("/");
    if (isPathMatching) {
      observor({ data: changeData, path: changePath, value: newValue });
    }
  });
}

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
