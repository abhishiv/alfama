export function crawl<T>(
  root: T,
  iterate: (node: T) => void,
  options: { order: "post"; getChildren: (node: T) => T[] }
) {
  if (options.order === "post") {
    dfsPostOrder(root, iterate, options.getChildren);
  }
}

function dfsPostOrder<T>(
  root: T,
  iterate: (node: T) => void,
  getChildren: (node: T) => T[]
) {
  const stack = [];
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
      const children = (getChildren(node) || []).reverse();
      children.forEach((child) => {
        if (!visited.has(child)) {
          stack.push({ node: child, visitedChildren: false });
        }
      });
    }
  }
}
