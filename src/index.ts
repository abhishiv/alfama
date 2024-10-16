export * from "./dom";
export type * from "./dom";
export * from "./core/state";
export * from "./stdlib/index";
export * from "./utils/index";

import { Signal } from "./core";
import { ComponentUtils } from "./dom";

export { getCursor } from "./utils/index";

export type UsePromiseResp<T = unknown, E = unknown> = {
  $data: Signal<T | undefined>;
  $error: Signal<E | undefined>;
  $loading: Signal<boolean | undefined>;
  $status: Signal<"loading" | "loaded" | "failed">;
};
