import {
  createProxy,
  getPath,
  ObjPathProxy,
  PATH_FLAG,
} from "./ts-object-path";

export type { ObjPathProxy } from "./ts-object-path";

export { PATH_FLAG } from "./ts-object-path";
// used to save additional data in proxy
export const META_FLAG = Symbol("META_FLAG");

export type CursorProxy<T = unknown, V = unknown> = ObjPathProxy<T, T>;

export type CursorProxyInternal<T = unknown, V = unknown> = CursorProxy<
  T,
  V
> & {
  [PATH_FLAG]: string[];
  [META_FLAG]: V;
};

export const wrapWithCursorProxy = <T = unknown, V = unknown>(
  obj: T,
  meta: any
): CursorProxy<T, V> => {
  const p = createProxy<T>([], {
    [META_FLAG]: meta,
  });
  return p as CursorProxy<T, V>;
};

export const isCursorProxy = (proxy: unknown) =>
  proxy && !!(proxy as CursorProxyInternal)[PATH_FLAG];

export const getCursor = (cursor: CursorProxy) => [
  ...(cursor as CursorProxyInternal)[PATH_FLAG],
];

export const getCursorProxyMeta = <T = unknown>(cursor: CursorProxy) =>
  (cursor as CursorProxyInternal)[META_FLAG] as T;
