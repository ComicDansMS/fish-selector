# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, dependency-free single page that shortlists aquarium fish from Australian stores that ship to South Australia. Users browse fish by group, filter and sort them, open a detail dialog, and build a list (the code calls it the cart) that is managed on a separate page and can be copied as text. The list is for ordering through a local fish shop, so the price shown everywhere is the average of the online stores' prices, as a rough guide. Stock status isn't shown. There is no build step, package manager, linter or test suite in the repo.

The catalogue is currently empty. The next job is to fill it: see "Curating the catalogue" below.

## Background: cloned from plant-selector

This project was cloned from `/Users/daniel/dev/plant-selector`, a sibling project that does the same job for aquarium plants for the same tank, and the plant-specific parts have been stripped out. Read that project to see how a finished catalogue looks and reads:

- `plants.js` holds about 360 plants in 8 zones (Foreground, Midground, Background, Attach to wood, Mosses, Emersed wood, Floating, Waterline). Each plant has a short plain-English `about`, `conditions` with a fixed vocabulary per label (so filters work), several credited `photos`, offers from many Australian online stores (Micro Aquatic Shop, Aquafy, Aquarzon, School of Scape, Nano Tanks Australia, ...) with a `unit` such as "Portion" or "Tissue culture cup", and `sources`.
- `saNote` is used for things that matter to a South Australian buyer, such as a species being a declared pest in SA, a store not stating that it ships to SA, or how SA tap water affects a plant.
- Its `CLAUDE.md` describes the same architecture as here, with zones in place of groups and an older cart storage format.

Match the plant catalogue's voice, level of detail and data quality when adding fish. The fish data has no `defaultOffer`, and saved lists use the simpler shape described under "Saved data" below.

## The tank

The livestock is being chosen for this one tank, so keep its size and setup in mind when deciding what belongs in the catalogue.

- **Aquarium**: Waterbox Clear 2420, rimless with an open top. 60 cm wide, 50 cm deep and 50 cm high. The substrate is about 9 cm high at the back and the water line sits about 2 cm below the top, so the water column at the back is about 39 cm.
- **Water volume**: about 100 litres, including the filter and hoses and minus the hardscape.
- **Water**: RO only, remineralised as needed. No parameters are set yet, so they can be chosen to suit the livestock (soft and acidic through to moderately hard). CO2 will lower the pH while it runs.
- **Maintenance**: the aim is no water changes, relying on a large amount of plants. Prefer a light bioload and species that cope with stable, mature water rather than needing frequent changes.
- **Light**: Maxspect Razor Nano R420R A8000 (60W, 8000K, freshwater). The photoperiod isn't decided, but will be a regular daily schedule.
- **Filter**: Oase BioMaster Thermo 250 (2nd generation), with a built-in heater. The outlet is at the back left and points to the front. Flow is ordinary, with some calmer areas likely.
- **CO2**: Dymax RX-123 regulator with a 0.75kg CO2 bottle. The schedule isn't decided, but will be regular.
- **Substrate**: a base of lava rock, pumice and Master Soil Next, capped with river sand.

Aquascape: river-inspired and heavily planted. The plant list is still being planned (in plant-selector).

- Two large pieces of driftwood that look like one, splitting apart from the centre to leave space between them at the top. They break the surface by about 150mm.
- Smooth river-style rocks around the base of the driftwood.
- Lush green plants of a smaller scale to suit the size of the tank.
- Background plants reach the surface.
- Midground plants surround the driftwood and grow out from between the pieces.
- Foreground plants grow from the crevices around the base of the driftwood and rocks, and are scattered around the sand.
- Some plants and mosses are attached to the driftwood, with some moss above the waterline.
- One or two plants are attached to the driftwood above the waterline, with their roots in the water.
- A peace lily is mounted to the glass in the back left corner.

## What the livestock should be

- **An ecosystem**: the tank should work like a small ecosystem. Every animal should have a purpose, such as algae grazing, eating leftovers and detritus, turning over the sand, controlling pests, being a school that fills the open water, or being the animal people stop to watch.
- **Variety**: a mix of animals to keep it interesting: fish, shrimp, snails and other invertebrates that suit a planted tank.
- **Small scale**: small animals, so the tank looks bigger, in the same way the plants are kept small-leaved.
- **Natural look**: they should look like they belong in a planted river scene. A pop of colour from one or two species is welcome, as long as it doesn't look out of place. Avoid gaudy or man-made looks (long-finned, GloFish, balloon and similar strains).
- **Schooling fish**: wanted, but there probably isn't room for a large school, so small species that look good in modest groups suit best.
- **Interest**: a couple of species should be fascinating to watch for their behaviour.
- **Betta**: a subtle-looking female betta is being considered.
- **Fits the tank**: peaceful with the other likely tankmates, safe with plants and shrimp where possible, and comfortable in the open top tank (jumpers are a real risk). With no water changes, a low bioload matters.

## Curating the catalogue

The page is the owner's central place to browse and consider livestock that a local fish shop in South Australia can order in. Don't pick the final stocking list. Curate a large, varied set of suitable options for the owner to choose from, then take to the shop.

- Include anything that suits the brief above, across fish, shrimp, snails and other invertebrates, and leave out what doesn't: too large, aggressive, plant-eating or digging, needing a much bigger tank, or with a bioload too high for a tank with no water changes.
- Use `about` to say what the animal is like and what role it can play in the tank (its purpose), and mention compatibility points such as eating shrimplets, jumping, or needing a group.
- Use `saNote` for South Australia matters, such as species that are restricted or noxious in SA, or stores that won't ship live animals to SA.
- Offers should come from Australian online stores that ship live animals to SA. The `unit` should say what the price is for (each, pair, pack of 10, ...). The average price is only a guide for ordering through the local shop.
- How to group the catalogue isn't decided yet. Grouping by role (for example schooling fish, centrepiece fish, bottom dwellers, clean-up crew, shrimp, snails) would echo the plant zones. Check with the owner before settling on it.
- `conditions` vocabulary isn't decided either. Useful labels are adult size, temperature, pH, hardness, temperament, swimming level, group size and shrimp safety. Settle each label's exact values before adding data in bulk, so filters added to `FACETS` match.
- As in plant-selector, keep the tank out of the data and UI: don't mention the tank, its model or its dimensions in `about`, `saNote`, group intros or anywhere on the page. Write descriptions so they apply to any planted tank.

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
