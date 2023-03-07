import { wire, wireAdopt, wirePause, wireResume } from "../state";

import type { Wire, SubToken } from "../state";
import { h } from "../dom";
import type { VirtualElement } from "../dom";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/** Switches DOM content by creating a wire responds to a changing condition. */
export const when = <T extends string>(
  condition: ($: SubToken) => T,
  views: { [k in T]?: () => VirtualElement }
): Wire<VirtualElement | undefined> => {
  type ActiveMeta = {
    elementRoot: VirtualElement | undefined;
    wireRoot: Wire<void>;
  };
  const active = {} as { [k in T]?: ActiveMeta };
  let condRendered: T;
  return wire(($) => {
    // Creates subscriptions to signals (hopefully)
    const cond = condition($);
    if (cond === condRendered) {
      return active[condRendered]!.elementRoot;
    }
    condRendered = cond;
    let a: ActiveMeta | undefined;
    // Else, content is changing. Pause wires for the current element
    if ((a = active[condRendered])) {
      wirePause(a.wireRoot);
    }
    // Have we rendered this condition before?
    if ((a = active[cond])) {
      // Then unpause its wires and return its pre-rendered element
      const stale = wireResume(a.wireRoot);
      if (stale) a.wireRoot();
      return a.elementRoot;
    }
    // Else, we need to render from scratch
    wireAdopt(undefined, () => {
      // The above line avoids the upper/lower relationship that's normally made
      // when creating a wire in a wire. This root is isolated.
      const wireRoot = wire(() => {});
      wireAdopt(wireRoot, () => {
        // All wires within views[cond] are adopted to wireRoot for pause/resume
        a = active[cond] = { elementRoot: h(views[cond]!), wireRoot };
      });
    });
    return a!.elementRoot;
  });
};
