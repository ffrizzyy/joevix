# Design and motion

Joevix follows Emil Kowalski's design-engineering rules: motion should explain state, confirm
input, or prevent a jarring change. If an interaction is frequent, keyboard-first, or purely
decorative, it should not animate.

## Motion tokens

Defined in `src/ui/base.css`:

| Token                 | Value                             | Use                                    |
| --------------------- | --------------------------------- | -------------------------------------- |
| `--jx-ease-out`       | `cubic-bezier(0.23, 1, 0.32, 1)`  | entering, exiting, press feedback      |
| `--jx-ease-in-out`    | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement                     |
| `--jx-duration-press` | `140ms`                           | button and switch press feedback       |
| `--jx-duration-ui`    | `160ms`                           | color, border, and small state changes |

The in-page edit bar mirrors the same values inside its shadow root (`--jv-ease-out`).

## Rules

- Animate `transform` and `opacity`; never animate layout properties.
- Keep UI motion under `300ms`.
- Use a custom strong ease-out curve; do not use built-in `ease-in` for UI.
- Pressable controls use `scale(0.97)` or `scale(0.96)` on `:active`.
- Hover styles live behind `@media (hover: hover) and (pointer: fine)`.
- Entering notices and the first-run welcome card use `@starting-style`, not keyframes.
- `.notice` and `.welcome` transitions are interruptible; rapid toggles retarget in place.
- Under `prefers-reduced-motion: reduce`, color/border/opacity transitions remain at `120ms`,
  while transform transitions and press scaling are removed.

## Playwright coverage

`tests/e2e/design.spec.ts` checks the built extension in Chromium:

- no computed transition uses `all` and no transition or animation exceeds `300ms`;
- buttons and switches reach their press scale while the pointer is down;
- hover styles are inside the fine-pointer media query and produce a visible hover state;
- reduced motion keeps color transitions, removes transform transitions, and disables press
  scaling.
