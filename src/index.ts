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

export function usePromise<T = unknown, E = unknown>(
  queryName: string,
  utils: ComponentUtils,
  promise: () => Promise<T>
): UsePromiseResp<T, E> {
  const $loading = utils.signal<boolean | undefined>(
    queryName + "/loading",
    true
  );
  const $data = utils.signal<any>(queryName + "/data", null);
  const $error = utils.signal<any>(queryName + "/error", true);
  const $status = utils.signal<"loading" | "loaded" | "failed">(
    queryName + "/status",
    "loading"
  );
  promise()
    .then((data) => {
      $data.set(data);
      $status.set("loaded");
      $loading.set(false);
    })
    .catch((err) => {
      console.log(err, err.message);
      $data.set(undefined);
      $error.set(err.message);
      $status.set("failed");
      $loading.set(undefined);
    });
  return { $data, $loading, $error, $status };
}
