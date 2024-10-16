export {
  component,
  h,
  render,
  unrender,
  Fragment,
  ParentWireContext,
  defineContext,
} from "./dom";
export type * from "./dom";
export {
  createSignal,
  createWire,
  createStore,
  createComputedSignal,
  produce,
  reify,
  getProxyMeta,
} from "./core/state";
export type * from "./core/state";
export * from "./stdlib/index";
export { getValueUsingPath } from "./utils/index";

import { Signal } from "./core";
import { ComponentUtils } from "./dom";

export { getCursor } from "./utils/index";

export type UsePromiseResp<T = unknown, E = unknown> = {
  $data: Signal<T | undefined>;
  $error: Signal<E | undefined>;
  $loading: Signal<boolean | undefined>;
  $status: Signal<"loading" | "loaded" | "failed">;
};
