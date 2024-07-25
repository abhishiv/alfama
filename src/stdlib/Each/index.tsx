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
    const eachCursorPath: string[] = getCursor(cursor);
    console.log("Each", eachCursorPath);

    const value: any[] = getValueUsingPath(
      store.value as any,
      eachCursorPath
    ) as any[];
    const observor = function ({ data, path }: StoreChange) {
      // important
      // filter changes so you don't try to render invalid changes
      if (path.slice(0, eachCursorPath.length).join("/") !== path.join("/"))
        return;

      //      console.log("list change", data, path, value);
      const pStep = parentStep.children[0];
      const previousChildren = [...(pStep.children || [])];
      if (data?.name === "push") {
        data.args.forEach((arg, i) => {
          const index = previousChildren.length + i; // push returns new length
          const { treeStep, el } = renderArray(
            pStep,
            props.renderItem,
            cursor,
            value,
            index
          );
          const { registry, root } = reifyTree(renderContext, el, pStep);
          addNode(renderContext, pStep, root);
        });
      } else if (data?.name === "pop") {
        if (previousChildren.length > 0) {
          const lastNode = previousChildren[previousChildren.length - 1];
          removeNode(renderContext, lastNode);
        }
      } else if (data?.name === "splice") {
        const [startIndex, deleteCount, ...items] = data.args as [
          number,
          number,
          ...any
        ];
        const nodesToRemove = previousChildren.slice(
          startIndex,
          startIndex + deleteCount
        );

        // Remove the nodes that are being spliced out
        nodesToRemove.forEach((n) => removeNode(renderContext, n));

        // Add the new nodes being spliced in
        items.forEach((item, i) => {
          const index = startIndex + i;
          const previousChildren = [...(pStep.children || [])];
          const { treeStep, el } = renderArray(
            pStep,
            props.renderItem,
            cursor,
            value,
            index
          );
          const { registry, root } = reifyTree(renderContext, el, pStep);
          const before = previousChildren[startIndex + i] || null;
          //          console.log(previousChildren);
          //          console.log("before", {
          //            startIndex,
          //            i,
          //            before,
          //            pStep,
          //            parentStep,
          //            root,
          //          });
          addNode(renderContext, pStep, root, before);
        });
      }
    };
    const task = { path: eachCursorPath, observor };
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
          {Object.keys(value).map((el, index) => {
            //            console.log("el", el, index, (cursor as any)[el]);
            return props.renderItem((cursor as any)[el], el as any);
          })}
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
  // console.log(getCursor(cursor));
  const vEl = renderItem((cursor as any)[index], index);
  const treeStep = getTreeStep(parentStep, undefined, vEl);
  return { treeStep, el: vEl };
};
