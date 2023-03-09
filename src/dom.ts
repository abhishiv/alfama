import { signal, wire, Wire } from "./experimental/state";
import { crawl } from "./crawl";
import type {
  GenericEventAttrs,
  HTMLAttrs,
  SVGAttrs,
  HTMLElements,
  SVGElements,
} from "./jsx";

export interface ComponentHelpers {
  wire: Function;
  signal: Function;
  createContext(name: string, defaultValue: any): any;
  getContext(token: any): any;
}
export type Component<T = any> = {
  (props: T, helpers: ComponentHelpers): VirtualElement;
} & { __name__: string };

export type PrimitiveType = string | number | boolean | null | undefined;
export type VirtualElement<T = any> =
  | {
      t: string | Component<T> | Wire;
      p: Record<string, PrimitiveType | Wire | Function> & {
        children: VirtualElement[];
      };
    }
  | PrimitiveType
  | Wire;

export type TreeStep = {
  id: string;
  node: VirtualElement;
  wires?: any[];
  signals?: any[];
  dom?: Element | Text | DocumentFragment;
  parent?: TreeStep;
  ctx: Record<string, any>;
};

function getLocalId(el: VirtualElement, i?: number): string {
  if (el && typeof el == "object") {
    if (typeof el.t === "function" && (el.t as Wire).$wire) return i + "";
    if (typeof el.t === "function") return (el.t as Component).__name__;
    return el.t;
  } else {
    return i + "";
  }
}

export function createDOMNode(step: TreeStep) {
  if (!step || !step.node) return;

  if (
    typeof step.node === "string" ||
    typeof step.node === "number" ||
    typeof step.node === "boolean"
  ) {
    return document.createTextNode(step.node + "");
  }

  if (step.node && (step.node as Wire).$wire) {
    const wire = step.node as Wire;
    const childEL = document.createTextNode(wire() + "");
    wire.tasks.add((val: any) => {
      childEL.textContent = val;
    });
    return childEL;
  }

  const props: Record<string, any> =
    typeof step?.node === "object" ? step?.node?.p : {};
  const tof = typeof step?.node;
  const t: Component = ((step.node as unknown as VirtualElement) || ({} as any))
    .t;

  if (typeof t === "function") {
    const frag = new DocumentFragment();
    return frag;
  }

  if (typeof t === "string") {
    const el = document.createElement(t);
    const { children, ...rest } = props;
    for (var key in rest) {
      const finalKey: string =
        key[0] == "o" && key[1] == "n" ? key.toLowerCase() : key;
      (el as any)[finalKey] = rest[key];
    }

    return el;
  }
}

function findAncestorWithCtxName(
  ctxName: string,
  node: TreeStep
): TreeStep | null {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.ctx && ancestor.ctx[ctxName]) {
      return ancestor;
    }
    ancestor = ancestor.parent;
  }
  return null;
}

export function crawlTree(el: VirtualElement) {
  const root: TreeStep = {
    id: getLocalId(el),
    node: el,
    signals: [],
    wires: [],
    ctx: {},
  };

  const intermediateRgeistry: any = {};
  intermediateRgeistry[root.id] = root;
  console.log(intermediateRgeistry);

  const registry: any = {};
  registry[root.id] = root;
  console.log(registry);

  const childrenMap: any = {};

  crawl(
    root,
    function (step) {
      const parent = step.parent;
      const dom = createDOMNode(step);
      if (dom) {
        step.dom = dom;
        registry[step.id] = step;
        const id = step.id;
        const parentId = id.substring(0, id.lastIndexOf("/"));
        childrenMap[parentId]
          ? childrenMap[parentId].push(step)
          : (childrenMap[parentId] = [step]);
        const children = childrenMap[id];
        if (children) {
          (dom as unknown as Element).append(
            ...children.map((el: TreeStep) => el.dom)
          );
        }
      } else {
      }
    },
    {
      order: "post",
      getChildren: ({ node, id: parentId }): TreeStep[] => {
        const parent = intermediateRgeistry[parentId] || root;
        if (node && typeof node === "object") {
          if ((node.t as Wire).$wire) {
            console.log("wire", node);
            return [];
          } else if (typeof node.t === "function") {
            const helpers = {
              signal: (val: any) => {
                const s = signal.anon(val);
                const parentRecord = intermediateRgeistry[parentId];
                parentRecord.signals.push(s);
                return s;
              },
              wire: (fn: Function) => {
                const w = wire(fn as any);
                const parentRecord = intermediateRgeistry[parentId];
                parentRecord.wires.push(w);
                return w;
              },
              createContext: (name: string, defaultValue: any) => {
                parent.ctx[name] = helpers.signal(defaultValue);
              },
              getContext: (token: any) => {
                const ancestor = findAncestorWithCtxName(token, parent);
                if (ancestor) {
                  return ancestor.ctx[token];
                } else {
                  // throw?
                }
              },
            };
            const el = node.t(node.p, helpers) as VirtualElement;
            return [el].map((el) => {
              const step = {
                id: parentId + "/" + getLocalId(el),
                node: el,
                signals: [],
                wires: [],
                parent,
                ctx: {},
              };
              intermediateRgeistry[step.id] = step;
              return step;
            });
          } else {
            return node?.p?.children.map((el, i) => {
              const step = {
                node: el,
                id: parentId + "/" + getLocalId(el, i),
                signals: [],
                wires: [],
                parent,
                ctx: {},
              };
              intermediateRgeistry[step.id] = step;
              return step;
            });
          }
        }
        return [];
      },
    }
  );
  return { registry: registry, root };
}

export function render(element: VirtualElement, container: HTMLElement) {
  const id = getLocalId(element);
  console.log(id);
  const domKey = id + "_dom";
  const existingState = (container as any)[id] || {};
  console.log(existingState);

  const { root, registry } = crawlTree(element);
  (container as any)[id] = registry;
  if (root.dom) {
    container.innerHTML = "";
    container.appendChild(root.dom);
  }
}

export function component<T = any>(
  name: string,
  def: {
    (props: T, helpers: ComponentHelpers): VirtualElement;
  }
): Component<T> {
  (def as Component<T>).__name__ = name;
  return def as Component<T>;
}

function h(t: any, p?: any, ...children: any): any {
  const props = {
    ...(p || {}),
    children: [...((p || {}).children || []), ...(children || [])],
  };
  return {
    id: typeof t == "string" ? t : t.__name__,
    p: props,
    t,
  };
}
export { h };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DistributeWire<T> = T extends any ? Wire<T> : never;

export declare namespace h {
  export namespace JSX {
    export type MaybeWire<T> = T | DistributeWire<T>;
    export type AllowWireForProperties<T> = { [K in keyof T]: MaybeWire<T[K]> };

    export type Element = VirtualElement;

    export interface ElementAttributesProperty {
      props: unknown;
    }
    export interface ElementChildrenAttribute {
      children: unknown;
    }

    // Prevent children on components that don't declare them
    export interface IntrinsicAttributes {
      children?: never;
    }

    // Allow children on all DOM elements (not components, see above)
    // ESLint will error for children on void elements like <img/>
    export type DOMAttributes<Target extends EventTarget> =
      GenericEventAttrs<Target> & { children?: unknown };

    export type HTMLAttributes<Target extends EventTarget> =
      AllowWireForProperties<Omit<HTMLAttrs, "style">> & {
        style?:
          | MaybeWire<string>
          | { [key: string]: MaybeWire<string | number> };
      } & DOMAttributes<Target>;

    export type SVGAttributes<Target extends EventTarget> =
      AllowWireForProperties<SVGAttrs> & HTMLAttributes<Target>;

    export type IntrinsicElements = {
      [El in keyof HTMLElements]: HTMLAttributes<HTMLElements[El]>;
    } & { [El in keyof SVGElements]: SVGAttributes<SVGElements[El]> };
  }
}
