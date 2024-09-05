/** @jsx h **/

import { h, component } from "../../dom";
import { unmount } from "../../dom/api";
import { ComponentTreeStep, VElement } from "../../dom/types";
import { getDescendants } from "../../dom/utils";

export type PortalProps = {
  mount: HTMLElement;
  children: VElement;
};

export const Portal = component<PortalProps>(
  "Portal",
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
    onUnmount((step: any) => {
      console.log("removeing Portal", step.dom);
      const nodes = getDescendants(step).filter((el) => el !== step);
      console.log("n", nodes);
      nodes.forEach((el) => {
        unmount(el);
      });
      //      unmount(step);
      if (step && step.dom && step.dom.remove) step.dom.remove();
    });
    (parentStep as ComponentTreeStep).mount = props.mount;
    return props.children;
  }
);
