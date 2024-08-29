# alfama

⚡ Fine grained reactive UI Library.

[![Version](https://img.shields.io/npm/v/alfama.svg?color=success&style=flat-square)](https://www.npmjs.com/package/alfama)
[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/abhishiv/alfama/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishiv/alfama/actions/workflows/ci.yml)
![Badge size](https://deno.bundlejs.com/?q=alfama&config={%22analysis%22:undefined}&badge=)

**npm**: `npm i alfama`

**cdn**: https://cdn.jsdelivr.net/npm/alfama/+esm

---

#### Features

- **Rich and Complete:** From support for `SVG` to popular patterns like `dangerouslySetInnerHTML`, `ref` to `<Fragment>` and `<Portal />` alfama has you covered.
- **Small:** Fully featured at `~9kB` gzip.
- **Truly reactive and fine grained:** Unlike VDOM libraries which use diffing to compute changes, it uses fine grained updates to target only the DOM which needs to update.
- **No Magic:** Explicit subscriptions obviate the need of [`sample`](https://github.com/luwes/sinuous/blob/8d1aa0cdb8a25e6bfcdf34f022523564a9adb533/src/observable.js#L34-L49)/[`untrack`](https://github.com/vobyjs/voby#untrack) methods found in other fine grained reactive libraries like solid/sinuous. _Importantly, many feel that this also makes your code easy to reason about._
- **Signals and Stores:** Signals for primitives and Stores for deeply nested objects/arrays.
- **First class HMR:** Preserves Signals/Stores across HMR loads for a truly stable HMR experience.
- **DevEx:** no compile step needed if you want: choose your view syntax: `h` for plain javascript or `<JSX/>` for babel/typescript.

#### Sponsors

<table>
  <tr>
    <td>
      <img width="25px" height="25px"  src="https://www.grati.co/images/favicon.png" />
    </td>
    <td>
      <a href="https://www.grati.co">grati.co</a>
    </td>
    <td>
      Next-Generation IDE
    </td>
  </tr>
</table>

#### Ecosystem

<table>
  <tr>
    <td>
      <a href="https://github.com/abhishiv/alfama-router">alfama-router</a>
    </td>
    <td>
      Router with a familiar react-router like API
    </td>
  </tr>
</table>

#### Example

[Counter - Codesandbox](https://codesandbox.io/s/counter-demo-alfama-t7ift3?file=/src/index.tsx)

```tsx
/** @jsx h **/
import { component, h, render } from "alfama";

// 1) The signal/wire/store functions are passed as a param to
// component definition
const Page = component("HomePage", (props, { signal, wire }) => {
  // 2) Named signals for stable HMR
  const [count, setCount] = signal("count", 0);

  // 3) Most importantly: wire reactivity to signals
  // with explicit subscription using the $ token param
  // NB: also makes code easy to reason about and prevents those pesky untrack/sample related errors
  const $doubleCount = wire(($) => count($) * 2);

  return (
    <div id="home">
      <p>Hey, {props.name}</p>
      <button onClick={() => setCount(count() + 1)}>
        Increment / {wire(count)} // or wire(($) => $(count))
      </button>
      <p>Double count = {$doubleCount}</p>
    </div>
  );
});

render(<Page name="John Doe" />, document.body);
```

## Motivation

This library is at its core inspired by [haptic](https://github.com/heyheyhello/haptic) that in particular it also favours manual subscription model instead of automatic subscriptions model. This oblivates the need of [`sample`](https://github.com/luwes/sinuous/blob/8d1aa0cdb8a25e6bfcdf34f022523564a9adb533/src/observable.js#L34-L49)/[`untrack`](https://github.com/vobyjs/voby#untrack) found in almost all other reactive libraries.

Also it borrows the nomenclature of aptly named Signal and Wire from haptic.

It's also influenced by Sinuous, Solid, & S.js

## API

### Core

<details>
  <summary><strong>signal</strong>: create a signal</summary>

```tsx
export const HomePage = component<{ name: string }>(
  "HomePage",
  (props, { signal, wire }) => {
    const [count, setCount] = signal("count", 0);
    //.. rest of component
  }
);
```

</details>
<details>
  <summary><strong>wire</strong>: create a wire</summary>

```tsx
<div id="home">
  <button
    onclick={() => {
      setCount(count() + 1);
    }}
  >
    Increment to {wire(($) => $(count))}
  </button>
</div>
```

</details>
<details>
  <summary><strong>store</strong>: create a store to hold object/arrays</summary>

```tsx
export const Todos = component("Todos", (props, { signal, wire, store }) => {
  const $todos = store("todos", {
    items: [{ task: "Do Something" }, { task: "Do Something else" }],
  });
  return (
    <ul>
      <Each
        cursor={$todos.items}
        renderItem={(item) => {
          return <li>{item.task}</li>;
        }}
      ></Each>
    </ul>
  );
});
```

</details>

<details>
  <summary><strong>defineContext</strong>: define context value</summary>

```tsx
export const RouterContext = defineContext<RouterObject>("RouterObject");
```

</details>

<details>
  <summary><strong>setContext</strong>: set context value</summary>

```tsx
const BrowserRouter = component("Router", (props, { setContext, signal }) => {
  setContext(
    RouterContext,
    signal("router", createRouter(window.history, window.location))
  );
  return props.children;
});
```

</details>

<details>
  <summary><strong>getContext</strong>: get context value</summary>

```tsx
const Link = component("Link", (props: any, { signal, wire, getContext }) => {
  const router = getContext(RouterContext);
  //... rest of component
});
```

</details>

<details>
  <summary><strong>onMount</strong>: triggered on mount</summary>

```tsx
export const Prosemirror = component("Prosemirror", (props, { onMount }) => {
  onMount(() => {
    console.log("component mounted");
  });
  // ...
});
```

</details>

<details>
  <summary><strong>onUnmount</strong>: triggered on unmount</summary>

```tsx
export const Prosemirror = component("Prosemirror", (props, { onUnmount }) => {
  onUnmount(() => {
    console.log("component unmounted");
  });
  // ...
});
```

</details>

### Helper Components

<details>
  <summary><strong>When</strong>: reactive if</summary>

```tsx
<When
  condition={($) => count($) > 5}
  views={{
    true: () => {
      return <div key="true">"TRUE"</div>;
    },
    false: () => {
      return <div key="false">"FALSE"</div>;
    },
  }}
></When>
```

</details>

<details>
  <summary><strong>Each</strong>: reactive map</summary>

```tsx
<Each
  cursor={$todos.items}
  renderItem={(item) => {
    return <li>{wire(item.task)}</li>;
  }}
></Each>
```

</details>

<details>
  <summary><strong>Portal</strong>: mount outside of render tree</summary>

```tsx
export const PortalExample = component("PortalExample", (props, utils) => {
  const [active, setActive] = utils.signal("active", false);
  return (
    <div>
      <button
        onClick={(e) => {
          setActive(!active());
        }}
      >
        toggle modal
      </button>
      <When
        condition={($) => active($)}
        views={{
          true: () => {
            return (
              <Portal mount={document.body}>
                <div style="position: fixed; max-width: 400px; max-height: 50vh; background: white; padding: 7px; width: 100%; border: 1px solid #000;top: 0;">
                  <h1>Portal</h1>
                </div>
              </Portal>
            );
          },
          false: () => {
            return "";
          },
        }}
      ></When>
    </div>
  );
});
```

</details>

## Reciepes

<details>
  <summary><strong>HMR</strong></summary>

```tsx
/** @jsx h **/
import { h, render } from "alfama";
import { Layout } from "./index";

const renderApp = ({ Layout }: { Layout: typeof Layout }) =>
  render(<Layout />, document.getElementById("app")!);

window.addEventListener("load", () => renderApp({ Layout }));

if (import.meta.hot) {
  import.meta.hot.accept("./index", (newModule) => {
    if (newModule) renderApp(newModule as unknown as { Layout: typeof Layout });
  });
}
```

</details>

<details>
  <summary><strong>Refs</strong></summary>

```tsx
/** @jsx h **/

export const Prosemirror = component("Prosemirror", (props, { onUnmount }) => {
  let container: Element | undefined = undefined;
  let prosemirror: EditorView | undefined = undefined;
  onUnmount(() => {
    if (prosemirror) {
      prosemirror.destroy();
    }
  });
  return (
    <div
      style="
    height: 100%;    position: absolute; width: 100%;"
      ref={(el) => {
        container = el;
        if (container) {
          prosemirror = setupProsemirror(container);
        }
      }}
    ></div>
  );
});
```

</details>

<details>
  <summary><strong>dangerouslySetInnerHTML</strong></summary>

```tsx
/** @jsx h **/
<div dangerouslySetInnerHTML={{ __html: `<!-- any HTML you want -->` }} />
```

</details>

## Concepts

### Signals

These are reactive read/write variables who notify subscribers when they've been written to. They act as dispatchers in the reactive system.

```tsx
const [count, setCount] = signal("count", 0);

count(); // Passive read (read-pass)
setCount(1); // Write

// also possible to use get/set on signal instead of tuples
const $count = signal("count", 0);
$count.get();
$count.set(5);
```

The subscribers to signals are wires, which will be introduced later. They subscribe by read-subscribing the signal.

### Stores

Stores are for storing nested arrays/objects and also act as dispatchers in the reactive system. And like signals, stores can also be read subsribed by wires. Outside of wires, they can be read via `reify` function. Writes can be done via `produce` function immer style.

```tsx
const val = { name: "Jane", friends: [{ id: "1", name: "John" }] };
const $profile = store("profile", val);

// Passive read (read-pass)
const friends = reify($profile.friends);
console.log(friends.length);
// Write
produce($profile.friends, (friends) => {
  friends.push({ id: "2", name: "John Doe 2" });
});
```

### Wires

These are task runners who subscribe to signals/stores and react to writes. They hold a function (the task) and manage its subscriptions, nested wires, run count, and other metadata. The wire provides a `$` token to the function call that, at your discretion as the developer, can use to read-subscribe to signals.

```tsx
wire(($) => {
  // Explicitly subscribe to count getter using the subtoken "$"
  const [count, setCount] = signal("count", 4);
  const countValue = $(count);

  // also possible to subscribe to a stores using "$" subtoken
  const friendsCount = $($profile.friends);
  return countValue + friendsCount;
});
```
