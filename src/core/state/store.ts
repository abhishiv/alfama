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
  try {
    const v = getValueUsingPath(manager.value as any, cursorPath);
    return v;
  } catch (e) {
    console.log(wire, wire.storesRS, encodedCursor, manager.value);
    throw e;
  }
}

// Handle changes in the store and trigger associated tasks and wires
export function handleStoreChange(
  manager: StoreManager,
  path: (string | symbol)[],
  newValue: any,
  oldValue: any,
  changeData: ApplyData
) {
  //  console.log("handleStoreChange", path, newValue, oldValue, changeData);
  const changePath = path as string[];
  adjustCursorForArrayChange(manager, path as string[], changeData);
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
      observor({
        data: (changeData
          ? {
              name: changeData.name,
              args: changeData.args,
              result: undefined,
            }
          : undefined) as any,
        path: changePath,
        value: newValue,
      });
    }
  });
}

//
// Function to adjust cursor paths for array changes
function adjustCursorForArrayChange(
  manager: StoreManager,
  changePath: string[],
  change: ApplyData
): void {
  if (!change || change.name !== "splice") {
    return;
  }
  const args = change.args as [string, string, ...any];
  const start = parseInt(args[0]);
  const deleteCount = parseInt(args[1]);
  const items = args.slice(2);

  //  console.log("adjustCursorForArrayChange", { start, deleteCount });

  manager.wires.forEach((wire) => {
    wire.storesRS.forEach((cursorSet) => {
      const { toRemove, toAdd } = adjustCursorsInSet(
        cursorSet,
        changePath,
        start,
        deleteCount,
        items
      );

      toRemove.forEach((cursor) => cursorSet.delete(cursor));
      toAdd.forEach((cursor) => cursorSet.add(cursor));

      //console.log({ toRemove, toAdd }, wire.storesRS);
    });
  });

  manager.tasks.forEach((task) => {
    if (isPathAffected(task.path, changePath)) {
      const listenerIndex = getListenerIndex(task.path, changePath.length);

      if (start + deleteCount <= listenerIndex) {
        const newIndex = listenerIndex - deleteCount + items.length;
        task.path[changePath.length] = newIndex.toString();
        //console.log("Updated task path", encodeCursor(task.path));
      }
    }
  });
}

function adjustCursorsInSet(
  cursorSet: Set<string>,
  changePath: string[],
  start: number,
  deleteCount: number,
  items: any[]
): { toRemove: string[]; toAdd: string[] } {
  const toRemove: string[] = [];
  const toAdd: string[] = [];

  cursorSet.forEach((cursorString) => {
    const cursor = decodeCursor(cursorString);
    if (isPathMatching(cursor, changePath)) {
      const listenerIndex = getListenerIndex(cursor, changePath.length);

      if (start + deleteCount <= listenerIndex) {
        toRemove.push(cursorString);
        cursor[changePath.length] = (
          listenerIndex -
          deleteCount +
          items.length
        ).toString();
        toAdd.push(encodeCursor(cursor));
      }
    }
  });

  return { toRemove, toAdd };
}

function isPathMatching(cursor: string[], changePath: string[]): boolean {
  return (
    encodeCursor(changePath) ===
    encodeCursor(cursor.slice(0, changePath.length))
  );
}

function getListenerIndex(cursor: string[], pathLength: number): number {
  return parseInt(cursor[pathLength]);
}

function isPathAffected(path: string[], changePath: string[]): boolean {
  return (
    encodeCursor(changePath) ===
      encodeCursor(path.slice(0, changePath.length)) &&
    path.length > changePath.length
  );
}
