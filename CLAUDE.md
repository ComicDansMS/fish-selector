# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, dependency-free single page that shortlists aquarium fish from Australian stores that ship to South Australia. Users browse fish by group, filter and sort them, open a detail dialog, and build a list (the code calls it the cart) that is managed on a separate page and can be copied as text. The list is for ordering through a local fish shop, so the price shown everywhere is the average of the online stores' prices, as a rough guide. Stock status isn't shown. There is no build step, package manager, linter or test suite in the repo.

The catalogue is currently empty. Requirements for which fish to include and how to group them are still to come.

## Running

Open `index.html` directly in a browser, or serve the directory with any static server (e.g. `python3 -m http.server`). All scripts are classic scripts loaded with `defer`, not ES modules, so the page still works from `file://`. Keep it that way: `fish.js` notes that jsdom-based tests run these scripts, and jsdom skips module scripts.

## Architecture

- `fish.js` sets `globalThis.FISH_CATALOGUE = { groups: [...] }`. It is pure JSON-style data. Each group has `id`, `name`, `intro` and `species`. Each fish has `id`, `name`, `scientific`, `difficulty`, `about`, `conditions` (array of `[label, value]` pairs, shown under "Care"), `saNote` (optional South Australia note, or `null`), `photos`, `offers` and `sources`.
- `core.js` is shared by both pages and exposes `globalThis.FISH_CORE`:
  - **Derived fish model**: it flattens the groups into `fishes` and adds `group`, `conditionMap`, `searchText`, `price` (the average of every offer's price, sold out or not, in cents, or `null` with no offers) and `order`. `byId` maps id to fish.
  - Helpers (`esc`, `money`, `quantityHTML`, `storesHTML` for the per-store price list, ...) and the image error fallback.
  - **Favourites**: fish being considered but not in the list. Saved as an array of ids under `fish-shortlist-favourites-v1`, separate from the cart. `isFavourite`/`setFavourite`, and `consideredFish()` returns them in catalogue order. `addToCart` removes a fish from favourites and favouriting a fish removes it from the list, so a fish is never in both. Changes go through the same `onCartChange` listeners.
  - **List state**: `lines` (one per fish, `{ selected, qty }`), persistence, `cartSummary`/`cartText`, and mutations (`updateCart`, `addToCart`, `removeFromCart`, `clearCart`) that save and then call listeners registered with `onCartChange`. It reloads on `storage` and back/forward cache `pageshow`, so a page stays in sync with changes made on the other page.
- `app.js` (on `index.html`) is a single IIFE for the catalogue:
  - **View state** (`view`: query, sort, facet sets, min/max price) drives `applyView()`, which re-filters and re-sorts the rendered cards. Facets are declared in `FACETS` (key, options, `test` fn) and sorts in `SORTS`. Add new filters or sorts there.
  - **Rendering** builds HTML strings and assigns them to `innerHTML`. Every interpolated value must go through `esc()`.
  - **Events** are delegated at `document` level. Clicks go through `[data-open-fish]`, then dialog backdrop/`[data-close]` handling, then the `CLICK_ACTIONS` table of `[selector, handler]` pairs. Use that table for new buttons rather than adding per-element listeners.
  - **Dialogs**: the fish modal, lightbox and filter drawer are native `<dialog>` elements in `index.html`, managed via `showDialog`/`dialogStack` so they stack correctly.
  - **Added notification**: `#added` (modelled on Dawn's cart notification) is a `popover`, not a dialog, so the page keeps scrolling. It hides after 3 seconds unless hovered or focused. `showAdded` moves it into the topmost open dialog first, because content outside a modal dialog is inert.
  - **Deep links**: `#fish-<id>` opens a fish (`syncHash`).
  - **History**: opening the fish modal pushes one history entry (state `{ fish: true }`) and moving between fish replaces it, so back (including the browser's edge swipe) closes the modal. Closing it any other way calls `history.back()`.
  - **Swipe**: the previous and next fish are rendered as inert copies (`.product-modal__peek`, ids stripped) either side of `#fish-dialog-body`. A sideways drag on the fish modal, outside the photo gallery and away from the screen edges, moves the track with the finger and steps when released past a third of the width or flicked. Scope queries for the current fish's content to `fishBody`, not `fishDialog`, so they don't match the copies.
- `list.js` (on `list.html`) renders the list grouped by group as `<details>` items: collapsed shows photo, name, quantity and price; expanded shows the average, each store's price and link, and quantity controls. Open items are kept in `expanded` so they survive re-renders. It also has its own `CLICK_ACTIONS` table, undo for removals, copy and clear.
- `styles.css` holds all styling. Colours are tokens on `:root` (`--accent`, `--coral`, ...) with dark-mode overrides. `--toolbar-height` is set from JS by a ResizeObserver so anchor jumps clear the sticky toolbar. The toolbar hides on scroll down and returns on scroll up (`is-hidden`), so group links scroll via `jumpTo`, which only leaves room for the toolbar when jumping up. Group headings (`.group__head`) are sticky at `--toolbar-bottom` (also set by the ResizeObserver), or at the top while the toolbar is hidden.

## Saved data (don't break saved lists)

The list persists to `localStorage` under `fish-shortlist-list-v1` as an object keyed by fish id, each value `{ selected, qty }`. Favourites persist under `fish-shortlist-favourites-v1` as an array of ids. So:

- Never renumber or reuse a fish `id`. New fish get the next unused number.
- Keep both storage keys and their shapes, or migrate old saves when changing them.
- Keep `#fish-<id>` deep links working.

## Data conventions in `fish.js`

- Prices are integer cents. `null` means no listed price. `was` is the pre-sale price, or `null`.
- `checked` is when the listing was last verified, formatted `YYYY-MM` or `YYYY-MM-DD`.
- Only individual store prices go in the data. The average is worked out in `core.js`.
- Filters match values exactly (`difficulty`: Easy/Moderate/Demanding). New data must use the same vocabulary, or it won't show up under those filters.
