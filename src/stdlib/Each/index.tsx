/** @jsx h **/

import {
  SubToken,
  StoreCursor,
  StoreManager,
  StoreChange,
} from "../../core/state";
import { h, component, Fragment } from "../../dom/index";
import { ComponentUtils, VElement } from "../../dom/types";
import { ParentWireContext } from "../../dom/index";
import { META_FLAG, getCursor } from "../../utils/index";
import { TreeStep } from "../../dom/types";
import { getUtils, addNode, removeNode } from "../../dom/api";
import { reifyTree, getTreeStep } from "../../dom/traverser";
import { getValueUsingPath } from "../../utils/index";

type ArrayOrObject = Array<unknown> | { [key: string]: unknown };

type ExtractElement<ArrayType extends ArrayOrObject> =
  ArrayType extends readonly (infer ElementType)[]
    ? ElementType
    : ArrayType extends { [key: string]: infer ElementType2 }
    ? ElementType2
    : never;

export const Each: <T extends ArrayOrObject>(
  props: {
    cursor: StoreCursor<T>;
    renderItem: (
      item: StoreCursor<ExtractElement<T>>,
      index: number
    ) => VElement;
  },
  utils: ComponentUtils
) => VElement = component(
  "Each",
  (
    props,
    {
      wire,
      setContext,
      signal,
      utils,
      step: parentStep,
      renderContext,
      onMount,
      onUnmount,
    }
  ) => {
    // todo: important memory leak
    const $rootWire = wire(($: SubToken) => {});
    setContext(ParentWireContext, signal("$wire", $rootWire));

    const cursor = props.cursor;
    const store: StoreManager = (cursor as any)[META_FLAG];
    const path: string[] = getCursor(cursor);

    const value: any[] = getValueUsingPath(store.value as any, path) as any[];

    const observor = function ({ data, path }: StoreChange) {
      //console.debug("change", changes, path);

      //      console.log("list change", data, path, value);
      const pStep = parentStep.children[0];
      if (data.name == "push") {
        const index = (data.result as number) - 1; // push returns index
        const { treeStep, el } = renderArray(
          pStep,
          props.renderItem,
          cursor,
          value,
          index
        );

        const { registry, root } = reifyTree(renderContext, el, pStep);
        addNode(renderContext, pStep, root);
      } else if (data.name === "pop") {
        if (!pStep || !pStep.children) return;
        const previousChildren = [...pStep.children];

        const firstNode = previousChildren[0];
        if (firstNode) removeNode(renderContext, firstNode);
      } else if (data.name === "splice") {
        const previousChildren = [...parentStep.children];
        const [startIndex, deleteCount, ...items] = data.args as [
          number,
          number,
          ...any
        ];
        const nodesToRemove = previousChildren.slice(
          startIndex,
          startIndex + deleteCount
        );
        nodesToRemove.forEach((n) => removeNode(renderContext, n));
        items.forEach((item, i) => {
          const index = startIndex + i;
          const { treeStep, el } = renderArray(
            pStep,
            props.renderItem,
            cursor,
            value,
            index
          );
          const previousChildren = [...pStep.children];
          const before = previousChildren[index];
          console.log("p", {
            previousChildren,
            before: before,
            parentStep,
            pStep,
            index,
          });
          const { registry, root } = reifyTree(renderContext, el, pStep);
          addNode(renderContext, pStep, root, before);
        });
        // todo: add nodes at proper position
        // needs modification of addNode function to take a treestep after which insertion should occur
      }
    };
    const task = { path, observor };
    onMount(() => {
      store.tasks.add(task);
    });
    onUnmount(() => {
      store.tasks.delete(task);
    });

    if (Array.isArray(value)) {
      // array
      return (
        <Fragment>
          {value.map((el, index) =>
            props.renderItem((cursor as any)[index], index)
          )}
        </Fragment>
      );
    } else {
      // object
      return (
        <Fragment>
          {Object.keys(value).map((el, index) =>
            props.renderItem((cursor as any)[el], el as any)
          )}
        </Fragment>
      );
    }
  }
);

const renderArray = (
  parentStep: TreeStep,
  renderItem: Function,
  cursor: any,
  list: any[],
  index: number | string
) => {
  const vEl = renderItem((cursor as any)[index], index);
  const treeStep = getTreeStep(parentStep, undefined, vEl);
  return { treeStep, el: vEl };
};
