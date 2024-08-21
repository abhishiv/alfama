import * as Constants from "../constants";
import { Wire, Signal, SignalGetter, ObjPathProxy } from "./types";
import { isCursorProxy } from "../../utils";

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
