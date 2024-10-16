import * as Constants from "../constants";
export {
  getCursorProxyMeta as getProxyMeta,
  getCursor as getProxyPath,
} from "../../utils/index";
export type { ObjPathProxy } from "../../utils/index";
import { Signal, SubToken, Wire } from "./types";
import { runWires } from "./wire";

let SIGNAL_COUNTER = 0;

export const createSignal = <T = any>(val: T): Signal<T> => {
  SIGNAL_COUNTER++;
  function get(token?: SubToken) {
    if (token) {
      // Two-way link. Signal writes will now call/update wire W
      token.wire.sigs.add(sig);
      sig.wires.add(token.wire);
      return sig.value as T;
    } else {
      return sig.value as T;
    }
  }

  const set = (value: T) => {
    if (sig.value === value) return value;
    sig.value = value;
    runWires(sig.wires);
    return val;
  };

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
    if (signal.get() !== wire.v) signal.set(wire.v as T);
  };
  wire.tasks.add(handler);
  return signal;
};
