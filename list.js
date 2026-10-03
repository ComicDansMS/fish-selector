(() => {
  "use strict";

  const {
    byId,
    $,
    $$,
    esc,
    money,
    clampQty,
    storesHTML,
    averageLabel,
    quantityHTML,
    stepQuantity,
    lines,
    cartSummary,
    checkedNote,
    cartText,
    onCartChange,
    updateCart,
    addToCart,
    removeFromCart,
    clearCart,
    setFavourite,
    consideredFish,
    storageOk,
    ICONS,
  } = globalThis.FISH_CORE;

  // Open items are remembered by fish so they stay open across re-renders.
  const expanded = new Set();
  let removedId = null;
  // Whether the last removal moved the fish to favourites.
  let moved = false;

  function itemHTML({ fish, line, sum }) {
    const key = `list-${fish.id}`;
    const priced = fish.price !== null;
    const stores = priced
      ? `<p class="cart-line__detail">${esc(averageLabel(fish))}</p>${storesHTML(fish)}`
      : '<p class="cart-line__warning">No price was listed. This fish is excluded from the total.</p>';
    return `<details class="list-item" data-line="${fish.id}"${expanded.has(fish.id) ? " open" : ""}>
      <summary class="list-item__summary">
        <img class="list-item__thumb" src="${esc(fish.photos[0].src)}" alt="" width="80" height="80" loading="lazy" decoding="async">
        <span class="list-item__heading">
          <span class="list-item__name">${esc(fish.name)}</span>
          <span class="list-item__qty">Qty ${line.qty}</span>
        </span>
        <button type="button" class="list-item__action" data-move-favourite="${fish.id}" aria-label="Move ${esc(fish.name)} to favourites" title="Move to favourites">${ICONS.heart}</button>
        <button type="button" class="list-item__action" data-remove="${fish.id}" aria-label="Remove ${esc(fish.name)}" title="Remove">${ICONS.bin}</button>
        <span class="list-item__price">${priced ? money(sum) : "Unpriced"}</span>
      </summary>
      <div class="list-item__body">
        <div class="cart-line__top">
          <p class="cart-line__sub">${esc(fish.scientific)}</p>
          <p class="cart-line__each">${priced ? money(fish.price) : "Unpriced"}<small>each</small></p>
        </div>
        ${stores}
        <div class="cart-line__controls">
          ${quantityHTML(key, fish.name, line.qty)}
          <a href="index.html#fish-${fish.id}">Fish details</a>
        </div>
      </div>
    </details>`;
  }

  function favouriteHTML(fish) {
    return `<li class="favourite">
      <img class="list-item__thumb" src="${esc(fish.photos[0].src)}" alt="" width="80" height="80" loading="lazy" decoding="async">
      <span class="list-item__heading">
        <a class="list-item__name" href="index.html#fish-${fish.id}">${esc(fish.name)}</a>
        <span class="list-item__qty">${fish.price === null ? "Unpriced" : `About ${money(fish.price)} each`}</span>
      </span>
      <span class="favourite__actions">
        <button type="button" class="list-item__action" data-unfavourite="${fish.id}" aria-label="Remove ${esc(fish.name)} from favourites" title="Remove from favourites">${ICONS.bin}</button>
        <button type="button" class="button favourite__add" data-add-favourite="${fish.id}" aria-label="Add ${esc(fish.name)} to list">Add to list</button>
      </span>
    </li>`;
  }

  function renderFavourites() {
    const considered = consideredFish();
    $("#favourites").hidden = considered.length === 0;
    $("#favourites-items").innerHTML = considered.map(favouriteHTML).join("");
  }

  function renderExpandButton() {
    const items = $$(".list-item");
    const allOpen = items.length > 0 && items.every((item) => item.open);
    $("#list-expand").textContent = allOpen ? "Collapse all" : "Expand all";
  }

  function render() {
    // The list is re-rendered on every change, so focus is carried across by
    // a stable key instead of being lost to the replaced nodes.
    const focusKey = document.activeElement?.dataset?.focusKey;
    const removeFocused = document.activeElement?.matches?.(
      "#list-groups [data-remove], #list-groups [data-move-favourite]",
    );
    if (removedId !== null && lines.get(removedId).selected) removedId = null;
    if (removedId === null) moved = false;
    const { groups, count, unknown } = cartSummary();

    $("#list-groups").innerHTML = groups
      .map(
        ({ group, entries, subtotal }) => `<section class="list-group" aria-label="${esc(group.name)}">
          <h2>${esc(group.name)}<span>${money(subtotal)}</span></h2>
          ${entries.map(itemHTML).join("")}
        </section>`,
      )
      .join("");

    $("#list-empty").hidden = count > 0;
    $("#list-content").hidden = count === 0;
    $("#list-save-note").textContent = storageOk()
      ? "Your list is saved on this device."
      : "Your list cannot be saved on this device.";
    const unknownNote = $("#list-unknown");
    unknownNote.hidden = unknown === 0;
    unknownNote.textContent = `Unpriced items: ${unknown}. Excluded from the total.`;
    $("#list-checked").textContent = checkedNote(
      groups.flatMap((group) => group.entries),
    );
    renderExpandButton();
    renderFavourites();

    const undo = $("#list-undo");
    undo.hidden = removedId === null;
    if (removedId !== null)
      $("#list-undo-text").textContent = `${byId.get(removedId).name} ${
        moved ? "moved to favourites" : "removed"
      }.`;

    const target = focusKey && $(`#list-groups [data-focus-key="${focusKey}"]`);
    if (target) target.focus({ preventScroll: true });
    else if (removeFocused && !undo.hidden)
      $("#list-undo-button").focus({ preventScroll: true });
  }

  async function copyList() {
    const text = cartText();
    const fallback = $("#list-copy-fallback");
    const status = $("#list-status");
    try {
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      status.textContent = "List copied as text.";
    } catch {
      // Clipboard access needs a secure context and permission, so show the
      // text where it can still be copied by hand.
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent =
        "Copying is not available here. The list is selected below for copying.";
    }
  }

  /* Events */

  const CLICK_ACTIONS = [
    ["[data-qty-step]", (el) => stepQuantity(el)],
    [
      "[data-remove]",
      (el) => {
        removedId = +el.dataset.remove;
        moved = false;
        expanded.delete(removedId);
        removeFromCart(removedId);
      },
    ],
    [
      "[data-move-favourite]",
      (el) => {
        removedId = +el.dataset.moveFavourite;
        moved = true;
        expanded.delete(removedId);
        // Favouriting also takes the fish out of the list.
        setFavourite(removedId, true);
      },
    ],
    [
      "#list-undo-button",
      () => {
        const id = removedId;
        removedId = null;
        moved = false;
        if (id === null) return;
        // Adding to the list also takes the fish back out of favourites.
        addToCart(id);
      },
    ],
    [
      "#list-clear",
      () => {
        removedId = null;
        moved = false;
        expanded.clear();
        clearCart();
      },
    ],
    ["[data-add-favourite]", (el) => addToCart(+el.dataset.addFavourite)],
    ["[data-unfavourite]", (el) => setFavourite(+el.dataset.unfavourite, false)],
    ["#list-copy", () => copyList()],
    [
      "#list-expand",
      () => {
        const items = $$(".list-item");
        const open = !items.every((item) => item.open);
        for (const item of items) {
          item.open = open;
          if (open) expanded.add(+item.dataset.line);
          else expanded.delete(+item.dataset.line);
        }
        renderExpandButton();
      },
    ],
  ];

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    for (const [selector, action] of CLICK_ACTIONS) {
      const el = target.closest(selector);
      if (el) {
        action(el);
        return;
      }
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-qty]")) {
      const id = Number(target.dataset.qty.slice("list-".length));
      updateCart(() => (lines.get(id).qty = clampQty(target.value)));
    }
  });

  // Toggle events do not bubble, hence the capture listener.
  document.addEventListener(
    "toggle",
    (event) => {
      const item = event.target;
      if (!item.classList?.contains("list-item")) return;
      if (item.open) expanded.add(+item.dataset.line);
      else expanded.delete(+item.dataset.line);
      renderExpandButton();
    },
    true,
  );

  onCartChange(render);
  render();
})();
