# DylanJS

Fine grained reactive UI Library

[![Version](https://img.shields.io/npm/v/dylanjs.svg?color=success&style=flat-square)](https://www.npmjs.com/package/dylanjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/abhishiv/dylanjs/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishiv/dylanjs/actions/workflows/ci.yml)
![Badge size](https://img.badgesize.io/https://cdn.jsdelivr.net/npm/dylanjs/+esm?compression=gzip&label=gzip&style=flat-square)

**npm**: `npm i dylanjs`  
**cdn**: https://cdn.jsdelivr.net/npm/dylanjs/+esm

---

-   **Small.** hello world at `~3kB` gzip.
-   **Truly reactive.** automatically derived from the app state.
-   **DevEx.** no compile step needed, choose your view syntax: `h` or `<JSX/>`.

#### Example

[Counter - Codesandbox](https://codesandbox.io/s/counter-demo-dylanjs-t7ift3?file=/src/index.tsx)

```tsx
/** @jsx h **/

import { component, h, render } from "dylanjs/dom";

export const HomePage = component<{ name: string }>(
    "HomePage",
    (props, { signal, wire }) => {
        const count = signal(0);
        return (
            <div id="home">
                <p>Hey, {props.name}</p>
                <button
                    onclick={() => {
                        count(count() + 1);
                    }}
                >
                    Increment to {wire(count)}
                </button>
            </div>
        );
    }
);

render(<HomePage name="John Doe" />, document.body);
```

## Motivation

The state part of this library is based on [haptic](https://github.com/heyheyhello/haptic) specially the concept of aptly named Signals and Wires. Like haptic it also favours manual subscription model instead of automatic subscriptions model.

It's also influenced by Sinuous, Solid, & S.js

### Signals

These are reactive read/write variables who notify subscribers when they've been written to. They are the only dispatchers in the reactive system.

```tsx
const state = signal({
    name: "Deciduous Willow",
    age: 85,
});

state.name; // [Function: signal|0{name}]
state.name(); // 'Deciduous Willow'
state.name("Willow");
state.name(); // 'Willow'
```

The subscribers to signals are wires, which will be introduced next. They subscribe by read-subscribing the signal. This is an important distinction - signals have two types of reads!

```tsx
state.name(); // Passive read (read-pass)
state.name($); // Subscribed read (read-subscribe)
```

This is unlike other reactive libraries, but it'll save us a lot of debugging. Separating the reads it makes subscribed reads an explicit and visually distinct action from passive reads. This makes Haptic an opt-in design, and it doesn't need the sample() function seen in other libraries. This is explained later when introducing wires, which is also where the $ value comes from.

### Wires

These are task runners who subscribe to signals and react to signal writes. They hold a function (the task) and manage its subscriptions, nested wires, run count, and other metadata. The wire provides a "$" token to the function call that, at your discretion as the developer, can use to read-subscribe to signals.

```tsx
/** @jsx h **/
wire(($) => {
    // Explicitly subscribe to state.name using the subtoken "$"
    const name = state.name($);
    console.log("Update to state.name:", name);
    return name;
});
```

## API

-   signal
-   wire
-   getContext
-   setContext
