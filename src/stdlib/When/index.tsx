/** @jsx h **/

import { SubToken } from "../../core/state";
import { h, component } from "../../dom";
import { VElement } from "../../dom/types";
import { ParentWireContext } from "../../dom/index";
import { addNode, removeNode } from "../../dom/api";
import { reifyTree } from "../../dom/traverser";

export type WhenViews =
  | Record<string, () => VElement>
  | ((value: any) => VElement);
export type WhenProps = {
  condition: ($: SubToken) => any;
  views: WhenViews;
  fallback?: () => VElement;
  options?: { cached?: boolean };
  key?: string;
};

export const When = component<WhenProps>(
  "When",
  (
    props,
    {
      wire,
      setContext,
      signal,
      utils,
      onUnmount,
      onMount,
      step: parentStep,
      renderContext,
    }
  ) => {
    const underlying = utils.wire(props.condition);
    const value = underlying.run();
    const getView = (value: any) => {
      //console.log("p", value, props.views, typeof props.views);
      if (typeof props.views === "function") {
        return () => (props.views as Function)(value);
      } else {
        return props.views[value as unknown as any] || props.fallback;
      }
    };
    const task = (value: any) => {
      const view = getView(value);
      const u = view ? view() : null;
      const previousChildren = [...parentStep.children];
      const { registry, root } = reifyTree(renderContext, u, parentStep);
      addNode(renderContext, parentStep, root);
      previousChildren.forEach((n) => removeNode(renderContext, n));
    };
    onMount(() => {
      underlying.tasks.add(task);
    });
    onUnmount(() => {
      underlying.tasks.delete(task);
    });
    const view = getView(value);
    return view ? view() : null;
  }
);
