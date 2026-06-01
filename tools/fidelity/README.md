# Visual-fidelity harness

A small dev tool for realizing a design handoff (e.g. a Claude Design prototype)
at pixel fidelity. It serves the prototype over HTTP, screenshots the same routes
in both the prototype and the running app, and reports page-height deltas — so
you **measure** the gaps instead of eyeballing them.

This is a dev-only tool. It is **not** part of the E2E suite and never touches
the database.

## Prereqs

- The prototype source dropped locally (gitignored), e.g.
  `design_handoff_helpdesk_redesign/prototype/`.
- The dev stack running: `bun run dev`.

## Usage

Three steps, two terminals:

```bash
# 1. terminal A — serve the prototype (defaults to design_handoff_helpdesk_redesign/prototype)
bun run fidelity:serve
#    other location:
PROTOTYPE_DIR=path/to/prototype bun run fidelity:serve

# 2. make sure the app is up
bun run dev

# 3. terminal B — capture + measure
bun run fidelity:shots
```

Output: a height-delta report in the console and full-page screenshots in
`tools/fidelity/.out/` (gitignored) named `proto-<screen>@<width>.png` and
`mine-<screen>@<width>.png`. Open the pairs side by side; use the Δ to find which
screens/sections drift.

## Per-redesign setup

Edit the top of [`capture.spec.ts`](./capture.spec.ts):

- **`ROUTES`** — `[prototypeRoute, appPath, screenshotName]` for each screen to
  compare.
- **`VIEWPORTS`** — keep the `980`-wide entry: that's the scaled-Windows band
  (~900–1024px CSS) where grids that collapse below `lg` blow up page height.
- **`PROTO_ROUTE_KEY`** — the prototypes pick a screen via a `localStorage` key
  (`hd_route`). If a handoff routes differently, adjust the prototype-navigation
  block in the spec.

Env overrides: `FIDELITY_APP_URL`, `FIDELITY_PROTO_URL`, `FIDELITY_EMAIL`,
`FIDELITY_PASSWORD`, `FIDELITY_PROTO_ROUTE_KEY`, and `PORT`/`PROTOTYPE_DIR` for
the server.

## Measuring specific regions

For exact per-element deltas (the most useful signal), add a step that reads
`getComputedStyle` (font-size **and** line-height) and `offsetHeight` on the
element in question — see the project memory `reference_visual_fidelity_harness`
for the workflow and the Tailwind v4 line-height gotcha.
