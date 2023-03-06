export const SIGNAL_TYPE = Symbol("signal");
export const WIRE_TYPE = Symbol("wire");
export const TOKEN_TYPE = Symbol("token");

export interface Signal<T = any> {
  (arg?: any): any;
  value: T;
  type: typeof SIGNAL_TYPE;
  tokens: SubToken[];
}
export interface Wire {
  (): any;
  type: typeof WIRE_TYPE;
  tasks: Function[];
}
export interface SubToken {
  (): any;
  type: typeof TOKEN_TYPE;
  deps: any[];
  wire: Wire;
}

export function createSignal<T>(arg?: T): Signal {
  let state;
  const signal = (arg?: SubToken | T) => {
    if (arg && (arg as SubToken).type == TOKEN_TYPE) {
      const token = arg as SubToken;
      signal.tokens.push(token);
      token.deps.push(signal);
      return signal.value;
    } else if (arg === undefined) {
      return signal.value;
    } else {
      signal.value = arg as T;
      for (var token of signal.tokens) {
        for (var task of token.wire.tasks) {
          task(arg);
        }
      }
    }
  };
  signal.type = SIGNAL_TYPE;
  signal.value = arg;
  signal.tokens = [] as SubToken[];
  return signal;
}
function getToken(wire: Wire) {
  const token: SubToken = () => {};
  token.type = TOKEN_TYPE;
  token.deps = [];
  token.wire = wire;
  return token;
}
export function wire(arg: Signal | ((token: SubToken) => void)) {
  const fn =
    (arg as Signal).type == SIGNAL_TYPE ? (token: SubToken) => arg(token) : arg;
  const wire = () => {
    const value = fn(token);
    return value;
  };
  const token = getToken(wire as unknown as Wire);
  wire.token = token;
  wire.tasks = [] as Function[];
  return wire;
}
