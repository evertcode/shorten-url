# Design

The visual system of the short link page and its "Link not found" page. Product truth lives in [PRODUCT.md](PRODUCT.md); the tokens live in [`web/styles.css`](web/styles.css).

## The idea

Every short link is a road sign: a route marker that points at its destination. The page borrows four things from road signage and nothing else: its typeface, its colours, its density and one signature move. Layout and controls stay the ordinary ones of a web form.

## Colour: each one has a single job

| Token | Value | Job |
| --- | --- | --- |
| `--color-sign` | `#00664f` | Guide signs: the masthead, the created link, the primary action, arrows. |
| `--color-legend` | `#ffffff` | Text and keyline on a guide sign. |
| `--color-shield` | `#f2b705` | Route shields: an alias, and nothing else. Also the text selection. |
| `--color-plate` | `#ffffff` (day), `#f4f2ec` (night) | Regulatory plates: where something is typed or stated. |
| `--color-plate-ink` | `#1b1b1b` | Text and borders on plates and shields. |
| `--color-error`, `--color-plate-error`, `--color-danger` | `#a81f17` (day), `#ffa197` on the night ground | Errors and the confirmation of a deletion. Nothing else. |
| `--color-ground` | `#e9e7e1` (day), `#181b1a` (night) | The page: pale concrete by day, asphalt by night. |
| `--color-ink`, `--color-ink-muted` | themed | Headings, labels and hints set directly on the ground. |

Dark mode changes the ground and the text set on it. Signs, shields and plates keep their colours, as real signs do at night.

All text pairs measure at least 5.6:1.

## Type

One family, Overpass (an open source descendant of Highway Gothic), self hosted through `@fontsource-variable/overpass`. No second typeface and no monospace.

- Wordmark: 800, `--text-wordmark`, fluid from 1.75rem to 3.5rem.
- Created link and 404 heading: 800, `--text-legend`.
- Section headings: 800, `--text-lg`.
- Body, labels and inputs: `--text-base` (1.125rem), labels at 600.
- Hints, errors, destinations in tight spots: `--text-sm`.

The wordmark is the host the page is served from, written by `web/brand.ts`. There is no other product name.

## Components

- **Guide sign** (`.sign`): green panel, 0.875rem radius, white keyline inset by 4px. Used for the masthead and the created link. Never for decoration.
- **Plate** (`.plate`, `.input`, `.link-row`, `.button-plate`): white, 2px black border. Inputs, list rows, secondary buttons, the 404 message.
- **Shield** (`.shield`): yellow, 3px black border, bold alias. It is the link to the short URL.
- **Arrow** (`#arrow` symbol): one drawn arrow, square ends, used pointing right in rows and results and rotated up-right in the masthead. No Unicode arrows.
- **Primary button**: solid sign green, white bold text, full width in the form.
- **Link row**: two lines. First the shield with Copy, Edit and Delete on the right; then the arrow and the destination. Edit swaps the destination for an input and the actions for Save and Cancel; Delete swaps them for a red question and a red Delete. Under 34rem the actions move to a third line.

No shadows, no gradients, no cards inside cards.

## Motion

One authored moment: the created link's sign wipes in from the left (360ms, exponential ease out). Buttons change colour in 120ms. Everything collapses under `prefers-reduced-motion`.

## Layout

A single column on phones, form first. From 62rem, two columns: the form and the created link on the left (20 to 27rem), the list on the right. Page width caps at 82rem.

## Rules for new work

- A new colour needs a new job. Do not reuse yellow or green for emphasis.
- Anything the owner types into or reads as a statement is a plate. Anything that points somewhere is a sign or a shield.
- Keep the sign construction (radius plus inset keyline) exclusive to things that name a place.
