// Shared by the fish list (app.js) and the list page (list.js): helpers, the
// derived fish model and the saved list.
(() => {
  "use strict";

  const { groups } = globalThis.FISH_CATALOGUE;

  // The list is saved as an object keyed by fish id, each holding whether
  // the fish is in the list and its quantity.
  const STORAGE_KEY = "fish-shortlist-list-v1";
  // Favourites are fish being considered but not yet in the list, saved as
  // an array of fish ids.
  const FAVOURITES_KEY = "fish-shortlist-favourites-v1";
  const MAX_QTY = 99;
  const DIFFICULTY = ["Easy", "Moderate", "Demanding"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const clampQty = (value) => {
    const n = Number(value);
    return Number.isFinite(n)
      ? Math.max(1, Math.min(MAX_QTY, Math.trunc(n)))
      : 1;
  };

  function formatChecked(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-AU", {
      timeGroup: "UTC",
      year: "numeric",
      month: "long",
      ...(day ? { day: "numeric" } : {}),
    }).format(new Date(Date.UTC(year, month - 1, day || 1)));
  }

  // The price shown for a fish is the average of every store's listed
  // price, as a rough guide to what a local shop will charge. Stock is left
  // out, since a sold out listing still says what the fish costs.
  const averagePrice = (offers) =>
    offers.length
      ? Math.round(
          offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length,
        )
      : null;

  const fishes = groups.flatMap((group) =>
    group.species.map((fish) => {
      const conditions = Object.fromEntries(fish.conditions);
      return {
        ...fish,
        group,
        conditionMap: conditions,
        searchText: `${fish.name} ${fish.scientific}`.toLowerCase(),
        price: averagePrice(fish.offers),
      };
    }),
  );
  fishes.forEach((fish, index) => (fish.order = index));
  const byId = new Map(fishes.map((fish) => [fish.id, fish]));

  /* Markup */

  const ICONS = {
    fish: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c3.5-6 10-6.5 15 0-5 6.5-11.5 6-15 0Z"/><path d="m17 12 5-4v8Z"/><path d="M7 11h.01"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
    bin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>',
  };

  const external = (url, label) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`;
  const credit = (photo) =>
    `${esc(photo.caption)}${photo.credit ? ` ${external(photo.creditUrl, esc(photo.credit))}` : ""}`;

  // Every store listing a fish, with its price and a link.
  function storesHTML(fish) {
    return `<ul class="stores" role="list">${fish.offers
      .map(
        (offer) => `<li class="stores__item">
          <span>${external(offer.url, `${esc(offer.shop)} ↗`)}${offer.unit ? `<span class="stores__unit">${esc(offer.unit)}</span>` : ""}</span>
          <span class="stores__price">${money(offer.price)}</span>
        </li>`,
      )
      .join("")}</ul>`;
  }

  const averageLabel = (fish) =>
    fish.offers.length > 1
      ? `Average of ${fish.offers.length} stores`
      : `From ${fish.offers[0].shop}`;

  function quantityHTML(key, name, qty) {
    return `<div class="quantity">
      <button type="button" class="quantity__button" data-qty-step="-1" data-focus-key="${key}-dec" aria-label="Decrease quantity of ${esc(name)}"${qty <= 1 ? " disabled" : ""}>&minus;</button>
      <input class="quantity__input" type="number" inputmode="numeric" min="1" max="${MAX_QTY}" step="1" value="${qty}" data-qty="${key}" data-focus-key="${key}" aria-label="Quantity of ${esc(name)}">
      <button type="button" class="quantity__button" data-qty-step="1" data-focus-key="${key}-inc" aria-label="Increase quantity of ${esc(name)}"${qty >= MAX_QTY ? " disabled" : ""}>+</button>
    </div>`;
  }

  // The stepper buttons change the input and then let the page's change
  // handler clamp and apply the new value, since the fish modal allows 0.
  function stepQuantity(button) {
    const input = $(".quantity__input", button.parentElement);
    input.value = Number(input.value) + Number(button.dataset.qtyStep);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* Saved list */

  // Every fish keeps a line in or out of the list, so a fish added again
  // comes back with its last quantity.
  const freshLine = () => ({ selected: false, qty: 1 });
  const lines = new Map(fishes.map((fish) => [fish.id, freshLine()]));
  const listeners = [];
  let storageOk = true;

  function restoreCart() {
    for (const fish of fishes) lines.set(fish.id, freshLine());
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      /* Invalid or unavailable storage leaves the default list usable. */
    }
    if (!state || typeof state !== "object" || Array.isArray(state)) return;
    for (const fish of fishes) {
      const saved = state[fish.id];
      if (!saved || typeof saved !== "object") continue;
      const line = lines.get(fish.id);
      if (typeof saved.selected === "boolean") line.selected = saved.selected;
      const qty = Number(saved.qty);
      if (Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY) line.qty = qty;
    }
  }

  function saveCart() {
    const state = Object.fromEntries(lines);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch {
      storageOk = false;
    }
  }

  /* Favourites */

  const favourites = new Set();

  // Adding a fish to the list takes it out of favourites. Older saves can
  // still have both, so fish in the list are skipped here (restoreCart runs
  // first).
  function restoreFavourites() {
    favourites.clear();
    try {
      const ids = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]");
      if (Array.isArray(ids))
        for (const id of ids)
          if (byId.has(id) && !lines.get(id).selected) favourites.add(id);
    } catch {
      /* Invalid or unavailable storage leaves no favourites. */
    }
  }

  function saveFavourites() {
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favourites]));
      storageOk = true;
    } catch {
      storageOk = false;
    }
  }

  const isFavourite = (id) => favourites.has(id);

  // A fish is never both in the list and a favourite, so favouriting a fish
  // in the list moves it out of the list.
  function setFavourite(id, on) {
    if (on) favourites.add(id);
    else favourites.delete(id);
    saveFavourites();
    const line = lines.get(id);
    if (on && line.selected) {
      line.selected = false;
      saveCart();
    }
    notify();
  }

  // Favourited fish, in catalogue order.
  const consideredFish = () =>
    fishes.filter((fish) => favourites.has(fish.id));

  function cartSummary() {
    let count = 0;
    let total = 0;
    let unknown = 0;
    const listed = [];
    for (const group of groups) {
      const entries = group.species
        .map(({ id }) => ({ fish: byId.get(id), line: lines.get(id) }))
        .filter(({ line }) => line.selected)
        .map((entry) => ({
          ...entry,
          sum: (entry.fish.price ?? 0) * entry.line.qty,
        }));
      if (!entries.length) continue;
      const subtotal = entries.reduce((sum, entry) => sum + entry.sum, 0);
      for (const entry of entries) {
        count += entry.line.qty;
        if (entry.fish.price === null) unknown += entry.line.qty;
      }
      total += subtotal;
      listed.push({ group, entries, subtotal });
    }
    return { groups: listed, count, total, unknown };
  }

  function renderBadges() {
    const { count, total } = cartSummary();
    $$("[data-cart-count]").forEach((el) => (el.textContent = count));
    $$("[data-cart-total]").forEach((el) => (el.textContent = money(total)));
  }

  function notify() {
    renderBadges();
    listeners.forEach((listener) => listener());
  }

  function onCartChange(listener) {
    listeners.push(listener);
  }

  function updateCart(change) {
    change();
    saveCart();
    notify();
  }

  function addToCart(id, { qty } = {}) {
    updateCart(() => {
      const line = lines.get(id);
      line.selected = true;
      if (qty !== undefined) line.qty = clampQty(qty);
      if (favourites.delete(id)) saveFavourites();
    });
  }

  function removeFromCart(id) {
    updateCart(() => (lines.get(id).selected = false));
  }

  function clearCart() {
    updateCart(() => {
      for (const fish of fishes) lines.set(fish.id, freshLine());
    });
  }

  // The list can change on the other page, either in another tab or before
  // coming back to a page kept in the back/forward cache.
  function reload() {
    restoreCart();
    restoreFavourites();
    notify();
  }
  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      event.key === STORAGE_KEY ||
      event.key === FAVOURITES_KEY
    )
      reload();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reload();
  });

  function checkedNote(entries) {
    const dates = entries
      .flatMap((entry) => entry.fish.offers.map((offer) => offer.checked))
      .sort();
    if (!dates.length) return "";
    const first = formatChecked(dates[0]);
    const last = formatChecked(dates.at(-1));
    return first === last
      ? `Prices checked ${first}.`
      : `Prices checked between ${first} and ${last}.`;
  }

  function cartText() {
    const { groups, total, unknown } = cartSummary();
    const out = ["Fish shortlist", ""];
    for (const { group, entries, subtotal } of groups) {
      out.push(`${group.name} (${money(subtotal)})`);
      for (const { fish, line, sum } of entries) {
        out.push(`- ${fish.name} (${fish.scientific}) x ${line.qty}`);
        out.push(
          fish.price === null
            ? "  No price listed"
            : `  About ${money(fish.price)} each (${averageLabel(fish).toLowerCase()}), ${money(sum)}`,
        );
      }
      out.push("");
    }
    out.push(`Estimated total: ${money(total)} AUD, based on average online prices.`);
    if (unknown)
      out.push(`Unpriced items: ${unknown}. Excluded from the total.`);
    const checked = checkedNote(groups.flatMap((group) => group.entries));
    if (checked) out.push(checked);
    return out.join("\n");
  }

  /* Image fallbacks */

  function imageFallback(img) {
    // A missing hover photo just means no hover swap.
    if (img.classList.contains("card__hover")) {
      img.remove();
      return;
    }
    const fallback = document.createElement("span");
    fallback.className = `img-fallback ${img.className}`.trim();
    if (img.alt) {
      fallback.setAttribute("role", "img");
      fallback.setAttribute("aria-label", `${img.alt} (photo unavailable)`);
    } else fallback.setAttribute("aria-hidden", "true");
    fallback.innerHTML = `${ICONS.fish}<span>Photo unavailable</span>`;
    img.replaceWith(fallback);
  }

  // Image error events do not bubble, so this listens in the capture phase
  // to cover images added after start up.
  document.addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLImageElement) imageFallback(event.target);
    },
    true,
  );

  restoreCart();
  restoreFavourites();
  renderBadges();

  globalThis.FISH_CORE = {
    groups,
    fishes,
    byId,
    MAX_QTY,
    DIFFICULTY,
    $,
    $$,
    esc,
    money,
    plural,
    clampQty,
    formatChecked,
    ICONS,
    external,
    credit,
    storesHTML,
    averageLabel,
    quantityHTML,
    stepQuantity,
    lines,
    cartSummary,
    checkedNote,
    cartText,
    renderBadges,
    onCartChange,
    updateCart,
    addToCart,
    removeFromCart,
    clearCart,
    isFavourite,
    setFavourite,
    consideredFish,
    storageOk: () => storageOk,
  };
})();
