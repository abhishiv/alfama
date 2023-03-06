/** @jsx h **/

import { component, h, render } from "dylanjs/dom";

export const HomePage = component<{ name: string }>(
  "HomePage",
  (props, { signal, wire }) => {
    const count = signal(0);
    return (
      <div id="home">
        <p>Hey, ${props.name}</p>
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
