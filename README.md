# DylanJS

Fine grained reactive UI Library

[![Version](https://img.shields.io/npm/v/dylanjs.svg?color=success&style=flat-square)](https://www.npmjs.com/package/dylanjs)
![Badge size](https://img.badgesize.io/https://cdn.jsdelivr.net/npm/dylanjs/+esm?compression=gzip&label=gzip&style=flat-square)

**npm**: `npm i dylanjs`  
**cdn**: https://cdn.jsdelivr.net/npm/dylanjs/+esm

---

-   **Small.** hello world at `~3kB` gzip.
-   **Truly reactive.** automatically derived from the app state.
-   **DevEx.** no compile step needed, choose your [view syntax](#view-syntax).

#### Example

[Counter - Codesandbox](https://stackblitz.com/edit/react-ts-8pa1lj?file=index.tsx)

```jsx
/** @jsx h **/

import { component, h, render } from "dylanjs/dom";

export const HomePage =
	component <
	{ name: string } >
	("HomePage",
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
	});

render(<HomePage name="John Doe" />, document.body);
```

## Motivation

The state part of this library is based on [haptic](https://github.com/heyheyhello/haptic). It's also influenced by Sinuous, Solid, S.js, Reactor.js, and Dipole.

## Reactive state

Defines **signals** as read/write reactive variables, and **wires** as reactive
functions. These are linked together into "subscriptions" to enable reactivity.

Subscriptions are a two-way linking between wires and signals, and are setup
when a wire runs its function. After, when a signal is written to, it runs all
of its subscribed wires. Subscribing is an explicit opt-in process, explained
below; there's no need for a `sample()` function found in other libraries.

The reactivity engine is resilient to errors. Individual signals and wires can
throw without disrupting the system. To help debugging, meaningful function
names are generated for both signals and wires and these show up naturally in
developer tools, console.log, and error stacktraces.

## Signals

These are reactive read/write variables who notify subscribers when they've been
written to. They are the only dispatchers in the reactive system.

```ts
const state = signal(0);

state(); // '0'
state(1);
state(); // '1'
```

The subscribers to signals are wires, which will be introduced next. They
subscribe by read-subscribing the signal. This is an important distinction -
signals have two types of reads!

```ts
state(); // Passive read (read-pass)
state($); // Subscribed read (read-subscribe)
```

This is unlike other reactive libraries, but it'll save us a lot of debugging.
Separating the reads it makes subscribed reads an explicit and visually distinct
action from passive reads. This makes Dylan an opt-in design, and it doesn't
need the `sample()` function seen in other libraries. This is explained later
when introducing wires, which is also where the `$` value comes from.

Any value can be written and stored in a signal, but if a wire is written, the
signal becomes a **lazy computed-signal** that returns the result of the wire's
function. It's like using a formula in a spreadsheet. These are really efficient
and only rerun the wire when dependencies mark the result as stale. These are
introduced later on.

## Wires

These are task runners who subscribe to signals and react to signal writes. They
hold a function (the task) and manage its subscriptions, nested wires, run
count, and other metadata. The wire provides a "\$" token to the function call
that, at your discretion as the developer, can use to read-subscribe to signals.

```ts
wire(($) => {
	// Explicitly subscribe to count using the subtoken "$"
	console.log("Update to count:", state($));
});
```

Earlier, when introducing signals, I mentioned a `sample()` method isn't needed.
Let's dive into that. Consider this code:

```ts
wire(($) => {
	const count = state($);
	console.log("Update to count:", count);
	// Calling a function...
	if (count > 10) pushToQueue(count);
});
```

**_Is this safe?_** i.e can we predict the subscriptions for this system? In
many reactive libraries the answer is no... We don't know what's happening in
that function call, so it could make any number of subscriptions by reading
other signals. These accidental subscriptions would cause unexpected runs that
can be hard to debug. **Here, it's safe**. The `$` token wasn't passed to
the function call, so we can guarantee our wire only subscribes to `state.name`.

In other libraries you need to remember to wrap all function calls in `sample()`
to opt-out of subscriptions. In Dylan, you pass around "$".

Here's some other features about wires:

-   They track which signals are read-passed and which are read-subscribed to
    maintain read consistency; if the same signal does `sig($)` and `sig()` the
    wire will throw.

-   They're finite-state-machines that can be reset, running, idle, paused, and
    stale. They use the FSM state to stop infinite loops, skip being run when
    paused or when part of a computed-signal, and knowing if they need to run
    once they're resumed.

-   They keep track of how many times they've run. This is useful for profiling
    and debugging.

-   The wire function has post-run tasks which are used to piggyback on a wire
    run in a non-destructive way. It may not seem immediately useful, but this
    is how `api.patch` wires reactivity into the DOM and is also why a single
    wire to be patched into multiple places in the DOM. Computed-signals update
    their stored values this way too.

-   In the rare case that a function (maybe third party) requires a "\$" token
    as a parameter but you don't want to consent to unknown subscriptions in
    your wire, you can import and pass the void-token "\$v" instead.

## Nice principals about state

-   Reading a signal (pass-read) is always safe. There should be no reason to wish
    you could snake around the function call by reading the stored value directly.
    This is because Dylan is explicit and there's no accidental subscriptions.

-   Wires can always be manually run by calling them and this won't cause other
    side-effects within the engine or trigger other chain reactions. It's safe to
    debug by calling.

-   Similarly, its expected that people will try interacting with wires and
    signals in the console. I try to make that debugging experience nice.

-   There's readable and consistent naming; no shorthand notations in code and
    function properties. They also all have nice JSDoc comments for your editor.

-   Computed-signals are lazy and will do their best to avoid redoing work. They
    don't even run when initialized.

-   Creating a computed-signal by writing an active/used wire into a signal
    provides a _reasonable_ experience but I don't recommend it. The wire will
    work as expected **until it is reset/unsubscribed by a subsequent write** to
    which replaces the wire. I've prioritized having consistent signal behaviour
    so writes _always_ write. I stop the wire so it doesn't keep running in the
    void and never get garbage collected. I don't want to throw or complain that
    the wire needs to be dealt with, so I default to resetting it. I understand
    this doesn't make everyone happy. If you plan to ever convert a
    computed-signal to a normal signal take care to re-run the wire if needed.
