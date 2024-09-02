// Crawl the tree in post-order.
export const crawl = <T>(
  root: T,
  iterate: (node: T) => void,
  options: { order: "post"; kids: (node: T) => T[] }
) => {
  if (options.order === "post") {
    dfsPostOrder(root, iterate, options.kids);
  }
};

// Helper function for dfsPostOrder.
export const dfsPostOrder = <T>(
  root: T,
  iterate: (node: T) => void,
  kids: (node: T) => T[]
) => {
  // The stack holds the nodes we need to visit.
  const stack: { node: T; visitedChildren: boolean }[] = [];
  // Keep track of the nodes we've visited.
  const visited = new Set();

  // Push the root node onto the stack to start the traversal.
  stack.push({ node: root, visitedChildren: false });

  while (stack.length > 0) {
    const { node, visitedChildren } = stack[stack.length - 1];
    // If all the node's children have been visited, visit the node and pop it from the stack.
    if (visitedChildren) {
      iterate(node);
      stack.pop();
    } else {
      visited.add(node);
      // Mark that we've visited the node's children.
      stack[stack.length - 1].visitedChildren = true;
      // Otherwise, push all the unvisited children onto the stack.
      const children = (kids(node) || []).reverse();
      children.forEach((child) => {
        if (!visited.has(child)) {
          stack.push({ node: child, visitedChildren: false });
        }
      });
    }
  }
};

// Helper function for dfsPreOrder.
export const dfsPreOrder = <T>(
  root: T,
  iterate: (attrs: { node: T; i: number }) => void | any,
  kids: (node: T) => T[]
) => {
  // The stack holds the nodes we need to visit.
  const stack: { node: T; i: number }[] = [];

  // Push the root node onto the stack to start the traversal.
  stack.push({ node: root, i: 0 });

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) return;

    // Visit the node.
    const v = iterate(node);
    if (v) return;

    // Push all the children onto the stack in reverse order so that
    // they are processed in the original order.
    const k = kids(node.node);
    //      console.log("k", k);
    const children = [...(k || [])].reverse();
    children.forEach((child, i) => {
      stack.push({ node: child, i });
    });
  }
};
