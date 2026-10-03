(() => {
  "use strict";

  const {
    groups,
    fishes,
    byId,
    DIFFICULTY,
    $,
    $$,
    esc,
    money,
    plural,
    clampQty,
    MAX_QTY,
    ICONS,
    external,
    credit,
    storesHTML,
    averageLabel,
    quantityHTML,
    stepQuantity,
    lines,
    checkedNote,
    onCartChange,
    addToCart,
    removeFromCart,
    isFavourite,
    setFavourite,
  } = globalThis.FISH_CORE;

  const reducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

  const FACETS = [
    {
      key: "difficulty",
      label: "Difficulty",
      options: DIFFICULTY.map((d) => [d, d]),
      test: (fish, value) => fish.difficulty === value,
    },
  ];

  const view = {
    query: "",
    sort: "featured",
    facets: new Map(FACETS.map((facet) => [facet.key, new Set()])),
    min: null,
    max: null,
  };

  const byName = (a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  function comparePrice(a, b, sign) {
    // Unpriced fish stay last in both directions.
    if (a.price === null || b.price === null)
      return Number(a.price === null) - Number(b.price === null) || byName(a, b);
    return sign * (a.price - b.price) || byName(a, b);
  }
  const difficultyRank = (fish) => DIFFICULTY.indexOf(fish.difficulty);
  const SORTS = {
    featured: (a, b) => a.order - b.order,
    "name-asc": byName,
    "name-desc": (a, b) => byName(b, a),
    "diff-asc": (a, b) =>
      difficultyRank(a) - difficultyRank(b) || byName(a, b),
    "diff-desc": (a, b) =>
      difficultyRank(b) - difficultyRank(a) || byName(a, b),
    "price-asc": (a, b) => comparePrice(a, b, 1),
    "price-desc": (a, b) => comparePrice(a, b, -1),
  };

  function matches(fish) {
    if (view.query && !fish.searchText.includes(view.query)) return false;
    for (const facet of FACETS) {
      const chosen = view.facets.get(facet.key);
      if (chosen.size && ![...chosen].some((v) => facet.test(fish, v)))
        return false;
    }
    if (view.min !== null || view.max !== null) {
      if (fish.price === null) return false;
      if (view.min !== null && fish.price < view.min) return false;
      if (view.max !== null && fish.price > view.max) return false;
    }
    return true;
  }

  /* Markup */

  function cardPriceHTML(fish) {
    if (fish.price === null) return '<span class="price__none">No price</span>';
    return `<span class="price__current">${money(fish.price)}</span>`;
  }

  function cardHTML(fish) {
    const [first, second] = fish.photos;
    // The hover photo gets no src until a mouse reaches the card, so touch
    // devices, which never show it, never download it.
    const hover = second
      ? `<img class="card__hover" data-src="${esc(second.src)}" alt="" width="600" height="600" decoding="async">`
      : "";
    return `<li class="product-grid__item" data-id="${fish.id}">
      <div class="card">
        <div class="card__media">
          <img src="${esc(first.src)}" alt="" width="600" height="600" loading="lazy" decoding="async">
          ${hover}
        </div>
        <div class="card__info">
          <h3 class="card__heading"><a class="card__link" href="#fish-${fish.id}" data-open-fish="${fish.id}">${esc(fish.name)}</a></h3>
          <p class="card__sub">${esc(fish.scientific)}</p>
          <span class="diff" data-d="${fish.difficulty}">${fish.difficulty}</span>
          <p class="price">${cardPriceHTML(fish)}</p>
        </div>
        <div class="card__actions">
          <button type="button" class="card__add" data-quick-add="${fish.id}" aria-pressed="false" aria-label="Add ${esc(fish.name)} to list">
            <span class="card__add-label">Add to list</span>
          </button>
          <button type="button" class="card__favourite" data-favourite="${fish.id}" aria-pressed="false" aria-label="Favourite ${esc(fish.name)}" title="Favourite">${ICONS.heart}</button>
        </div>
      </div>
    </li>`;
  }

  function renderGroups() {
    $("#group-sections").innerHTML = groups
      .map(
        (group) => `<section class="group" id="g-${group.id}" aria-labelledby="g-${group.id}-title">
          <div class="group__head">
            <h2 id="g-${group.id}-title">${esc(group.name)}</h2>
            <p class="group__count"></p>
          </div>
          <p class="group__intro">${esc(group.intro)}</p>
          <ul class="product-grid" role="list">${group.species.map((p) => cardHTML(byId.get(p.id))).join("")}</ul>
        </section>`,
      )
      .join("");
    $("#groups").innerHTML = groups
      .map((group) => `<a href="#g-${group.id}">${esc(group.name)}</a>`)
      .join("");
  }

  /* Search, sort and filters */

  function renderFacetForm() {
    const count = (facet, value) =>
      fishes.filter((fish) => facet.test(fish, value)).length;
    const highest = Math.max(0, ...fishes.map((fish) => fish.price ?? 0));
    $("#filter-form").innerHTML =
      FACETS.map(
        (facet) => `<fieldset class="facet">
          <legend>${facet.label}</legend>
          ${facet.options
            .map(
              ([value, label]) => `<label class="facet__option">
                <input type="checkbox" name="${facet.key}" value="${esc(value)}">
                <span>${esc(label)}</span>
                <span class="facet__count">${count(facet, value)}</span>
              </label>`,
            )
            .join("")}
        </fieldset>`,
      ).join("") +
      `<fieldset class="facet">
        <legend>Price</legend>
        <p class="facet__hint">Uses the average store price for each fish. Fish without a price are hidden while a price is set.</p>
        <div class="facet__range">
          <label><span>From $</span><input type="number" name="min" min="0" step="1" inputmode="decimal" placeholder="0"></label>
          <label><span>To $</span><input type="number" name="max" min="0" step="1" inputmode="decimal" placeholder="${Math.ceil(highest / 100)}"></label>
        </div>
      </fieldset>`;
  }

  function readFacetForm() {
    const form = $("#filter-form");
    for (const facet of FACETS) {
      view.facets.set(
        facet.key,
        new Set(
          $$(`input[name="${facet.key}"]:checked`, form).map((i) => i.value),
        ),
      );
    }
    const cents = (input) =>
      input.value === "" || !Number.isFinite(Number(input.value))
        ? null
        : Math.round(Number(input.value) * 100);
    view.min = cents(form.elements.min);
    view.max = cents(form.elements.max);
  }

  function writeFacetForm() {
    const form = $("#filter-form");
    for (const facet of FACETS) {
      $$(`input[name="${facet.key}"]`, form).forEach((input) => {
        input.checked = view.facets.get(facet.key).has(input.value);
      });
    }
    form.elements.min.value = view.min === null ? "" : view.min / 100;
    form.elements.max.value = view.max === null ? "" : view.max / 100;
  }

  function activeFacets() {
    const active = [];
    for (const facet of FACETS) {
      for (const value of view.facets.get(facet.key)) {
        const [, label] = facet.options.find(([v]) => v === value);
        active.push({
          id: `${facet.key}:${value}`,
          label: `${facet.label}: ${label}`,
        });
      }
    }
    const dollars = (cents) => `$${cents / 100}`;
    if (view.min !== null || view.max !== null) {
      const range =
        view.min !== null && view.max !== null
          ? `${dollars(view.min)} to ${dollars(view.max)}`
          : view.min !== null
            ? `from ${dollars(view.min)}`
            : `up to ${dollars(view.max)}`;
      active.push({ id: "price", label: `Price: ${range}` });
    }
    return active;
  }

  let renderedSort = null;
  function applyView() {
    let total = 0;
    for (const section of $$(".group")) {
      const list = $(".product-grid", section);
      const items = $$(".product-grid__item", list);
      // Moving nodes can drop keyboard focus, so only reorder when the sort
      // actually changed.
      if (renderedSort !== view.sort) {
        items
          .sort((a, b) =>
            SORTS[view.sort](byId.get(+a.dataset.id), byId.get(+b.dataset.id)),
          )
          .forEach((item) => list.append(item));
      }
      let count = 0;
      for (const item of items) {
        item.hidden = !matches(byId.get(+item.dataset.id));
        if (!item.hidden) count++;
      }
      section.hidden = count === 0;
      $(".group__count", section).textContent = plural(count, "fish", "fish");
      $(`#groups a[href="#${section.id}"]`).hidden = count === 0;
      total += count;
    }
    renderedSort = view.sort;

    const active = activeFacets();
    // The count only shows while something narrows the list, but stays in the
    // accessibility tree so changes are still announced.
    const resultCount = $("#result-count");
    resultCount.textContent =
      total === fishes.length
        ? plural(total, "fish", "fish")
        : `${total} of ${plural(fishes.length, "fish", "fish")}`;
    resultCount.classList.toggle(
      "visually-hidden",
      !view.query && !active.length,
    );
    $("#empty").hidden = total > 0;
    $("#filters-apply").textContent = `Show ${plural(total, "fish", "fish")}`;

    const badge = $("#filter-count");
    badge.hidden = !active.length;
    badge.textContent = active.length;
    $("#open-filters").setAttribute(
      "aria-label",
      active.length ? `Filter, ${active.length} active` : "Filter",
    );
    const chips = $("#active-facets");
    chips.hidden = !active.length;
    chips.innerHTML = active.length
      ? active
          .map(
            ({ id, label }) =>
              `<li><button type="button" class="chip" data-remove-facet="${esc(id)}" aria-label="Remove filter ${esc(label)}">${esc(label)}${ICONS.close}</button></li>`,
          )
          .join("") +
        '<li><button type="button" class="link-button" data-clear-facets>Clear all</button></li>'
      : "";
  }

  function clearFacets() {
    view.facets.forEach((set) => set.clear());
    view.min = view.max = null;
    writeFacetForm();
  }

  /* Dialogs */

  // The top layer cannot be queried for its order, so open dialogs are
  // tracked here, oldest first.
  const dialogStack = [];
  $$("dialog").forEach((dialog) =>
    dialog.addEventListener("close", () => {
      const index = dialogStack.indexOf(dialog);
      if (index >= 0) dialogStack.splice(index, 1);
    }),
  );

  function showDialog(dialog) {
    if (dialog.open) return;
    dialog.showModal();
    // Focus the dialog itself rather than its first button. iOS Safari shows
    // a focus ring on whatever showModal() focuses, even after a tap.
    dialog.focus();
    dialogStack.push(dialog);
  }

  // A dialog that is already open underneath another one has to be reopened
  // to come to the front. The flag lets close handlers tell this apart from a
  // real close, whether the close event arrives now or after reopening.
  function bringToFront(dialog) {
    if (dialog.open && dialogStack.at(-1) !== dialog) {
      dialog.dataset.reopening = "";
      dialog.close();
      delete dialog.dataset.reopening;
    }
    showDialog(dialog);
  }

  /* Added to list notification (Dawn's cart notification) */

  // A popover rather than a dialog, so the page behind keeps scrolling. Over
  // the fish modal it has to live inside that dialog, because everything
  // outside a modal dialog is inert.
  const added = $("#added");
  const ADDED_TIMEOUT = 3000;
  let addedTimer;

  function hideAdded() {
    clearTimeout(addedTimer);
    if (added.matches(":popover-open")) added.hidePopover();
  }

  // Hovering or focusing the notification pauses the timer; leaving it
  // starts it again.
  function hideAddedLater() {
    clearTimeout(addedTimer);
    addedTimer = setTimeout(hideAdded, ADDED_TIMEOUT);
  }

  function showAdded(title) {
    added.classList.remove("added--message");
    $("#added-title-text").textContent = title;
    openAdded();
  }

  function removeFromList(id) {
    removeFromCart(id);
    showMessage(`${byId.get(id).name} removed from your list`);
  }

  // Called before adding, since adding takes the fish out of favourites
  // and updating changes the quantity.
  function addedTitle(id, qty) {
    const line = lines.get(id);
    if (line.selected)
      return `${byId.get(id).name} changed from ${line.qty} to ${qty} in your list`;
    return isFavourite(id) ? "Moved to your list" : "Added to your list";
  }

  // The same notification without the View list button, for short messages.
  function showMessage(text) {
    added.classList.add("added--message");
    $("#added-title-text").textContent = text;
    openAdded();
  }

  function openAdded() {
    hideAdded();
    (dialogStack.at(-1) ?? document.body).append(added);
    added.showPopover();
    hideAddedLater();
  }

  function renderListState() {
    for (const button of $$("[data-quick-add]")) {
      const selected = lines.get(+button.dataset.quickAdd).selected;
      button.setAttribute("aria-pressed", String(selected));
      $(".card__add-label", button).textContent = selected
        ? "In list"
        : "Add to list";
    }
    for (const button of $$("[data-favourite]")) {
      button.setAttribute(
        "aria-pressed",
        String(isFavourite(+button.dataset.favourite)),
      );
    }
    renderFishListState();
  }

  /* Fish modal */

  const modal = { id: null, photo: 0, qty: 1 };
  const fishDialog = $("#fish-dialog");
  const fishBody = $("#fish-dialog-body");
  const fishPanel = $(".product-modal__panel", fishDialog);
  const fishTrack = $(".product-modal__track", fishDialog);
  const peeks = $$(".product-modal__peek", fishDialog);
  const lightbox = $("#lightbox");
  const pageURL = () => location.pathname + location.search;

  // Previous and next follow the grid as currently sorted and filtered. A
  // fish opened from a deep link may be filtered out, so then the full list
  // is used instead.
  function visibleOrder() {
    const visible = $$(".group:not([hidden]) .product-grid__item:not([hidden])")
      .map((item) => +item.dataset.id);
    return visible.includes(modal.id)
      ? visible
      : $$(".product-grid__item").map((item) => +item.dataset.id);
  }

  function galleryHTML(fish) {
    const count = fish.photos.length;
    const slides = fish.photos
      .map(
        (photo, i) => `<figure class="gallery__slide" role="group" aria-label="Photo ${i + 1} of ${count}">
          <button type="button" class="gallery__zoom" data-zoom="${i}" aria-label="View photo ${i + 1} full screen">
            <img src="${esc(photo.src)}" alt="${esc(`${fish.name}: ${photo.caption}`)}" width="720" height="720" loading="${i ? "lazy" : "eager"}" decoding="async">
          </button>
          <figcaption class="gallery__caption">${credit(photo)}</figcaption>
        </figure>`,
      )
      .join("");
    const thumbs = fish.photos
      .map(
        (photo, i) => `<li><button type="button" class="gallery__thumb" data-goto="${i}" aria-label="Show photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}>
          <img src="${esc(photo.src)}" alt="" width="120" height="120" loading="lazy" decoding="async">
        </button></li>`,
      )
      .join("");
    return `<div class="gallery">
      <div class="gallery__viewport" tabindex="0" role="region" aria-label="${esc(fish.name)} photos, use the arrow keys to browse">${slides}</div>
      <div class="gallery__nav">
        <button type="button" class="icon-button" data-photo="-1" aria-label="Previous photo" disabled>${ICONS.prev}</button>
        <span class="gallery__counter" aria-live="polite">1 / ${count}</span>
        <button type="button" class="icon-button" data-photo="1" aria-label="Next photo"${count < 2 ? " disabled" : ""}>${ICONS.next}</button>
      </div>
      <ul class="gallery__thumbs" role="list">${thumbs}</ul>
    </div>`;
  }

  const section = (title, body) =>
    `<section class="product__section">
      <h3>${title}</h3>
      ${body}
    </section>`;

  const fishBodyHTML = (fish, qty) =>
    `<div class="product__media">${galleryHTML(fish)}</div>
    <div class="product__info">${fishInfoHTML(fish, qty)}</div>`;

  function fishInfoHTML(fish, qty) {
    const conditions = `<dl class="conditions">${fish.conditions
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("")}</dl>`;
    const sources = `<ul class="link-list">${fish.sources
      .map((source) => `<li>${external(source.url, esc(source.label))}</li>`)
      .join("")}</ul>`;

    return `<p class="product__group">${esc(fish.group.name)}</p>
      <h2 class="product__title" id="fish-dialog-title">${esc(fish.name)}</h2>
      <p class="product__sub">${esc(fish.scientific)}</p>
      <span class="diff" data-d="${fish.difficulty}">Difficulty: ${fish.difficulty}</span>
      ${fishPriceHTML(fish)}
      <div class="product__form">
        ${quantityHTML("fish", fish.name, qty)}
        <button type="button" class="button button--secondary product__favourite" data-favourite="${fish.id}" aria-pressed="${isFavourite(fish.id)}">${ICONS.heart}<span>Favourite</span></button>
        <button type="button" class="button product__add" id="fish-add">Add to list</button>
      </div>
      <div class="product__in-list" id="fish-in-list" hidden></div>
      <p class="product__about">${esc(fish.about)}</p>
      ${fish.offers.length ? section("Where to buy", `${storesHTML(fish)}<p class="product__checked">${checkedNote([{ fish }])}</p>`) : ""}
      ${section("Care", conditions)}
      ${fish.saNote ? section("South Australia", `<p>${esc(fish.saNote)}</p>`) : ""}
      ${section("Sources", sources)}`;
  }

  function fishPriceHTML(fish) {
    if (fish.price === null)
      return '<div class="product__price"><span class="price__none">No Australian store listing with a price was found.</span></div>';
    return `<div class="product__price">
        <span class="price__current">${money(fish.price)}</span>
        <p class="product__price-note">${esc(averageLabel(fish))}</p>
      </div>`;
  }

  function renderFishListState() {
    if (modal.id === null) return;
    if (!lines.get(modal.id).selected && modal.qty < 1) modal.qty = 1;
    renderLineState(fishBody, modal.id, modal.qty);
    for (const peek of peeks)
      if (peek.dataset.id)
        renderLineState(peek, +peek.dataset.id, startQty(+peek.dataset.id));
  }

  // A fish in the list can go down to 0, which removes it on update, and
  // updating is only offered once the quantity differs from the list's.
  function renderLineState(root, id, qty) {
    const fish = byId.get(id);
    const line = lines.get(id);
    const min = line.selected ? 0 : 1;
    const input = $(".quantity__input", root);
    input.min = min;
    input.value = qty;
    input.previousElementSibling.disabled = qty <= min;
    input.nextElementSibling.disabled = qty >= MAX_QTY;
    const add = $(".product__add", root);
    add.textContent = line.selected ? "Update list" : "Add to list";
    add.disabled = line.selected && qty === line.qty;
    const box = $(".product__in-list", root);
    box.hidden = !line.selected;
    if (!line.selected) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<p>In your list: ${line.qty}.</p>
      <button type="button" class="link-button" data-remove="${fish.id}" aria-label="Remove ${esc(fish.name)} from list">Remove from list</button>
      <a href="list.html">View list</a>`;
  }

  function setModalQty(qty) {
    modal.qty =
      Math.trunc(Number(qty)) <= 0 && lines.get(modal.id).selected
        ? 0
        : clampQty(qty);
    renderFishListState();
  }

  function openFish(id) {
    const fish = byId.get(id);
    if (!fish) return;
    Object.assign(modal, { id, photo: 0, qty: startQty(id) });
    fishBody.innerHTML = fishBodyHTML(fish, modal.qty);

    const order = visibleOrder();
    const index = order.indexOf(id);
    renderPeeks(order, index);
    renderFishListState();
    $("#fish-position").textContent = `${index + 1} of ${order.length}`;
    $('[data-step="-1"]', fishDialog).disabled = index <= 0;
    $('[data-step="1"]', fishDialog).disabled = index >= order.length - 1;

    // Opening the modal adds a history entry, so back (including the edge
    // swipe, which a page can't block) closes it. Moving between fish
    // replaces that entry. A deep link's own entry loses its hash first, so
    // back from it lands on the plain page.
    const url = `#fish-${id}`;
    if (fishDialog.open || history.state?.fish)
      history.replaceState(history.state, "", url);
    else {
      if (location.hash.startsWith("#fish-"))
        history.replaceState(history.state, "", pageURL());
      history.pushState({ ...history.state, fish: true }, "", url);
    }
    bringToFront(fishDialog);
    fishPanel.scrollTop = 0;
  }

  function startQty(id) {
    const line = lines.get(id);
    return line.selected ? line.qty : 1;
  }

  // The previous and next fish are rendered either side of the current one
  // so a swipe can drag them into view. They are inert copies with the ids
  // removed, and their first photos load now so they are ready to show.
  function renderPeeks(order, index) {
    for (const peek of peeks) {
      const fish = byId.get(order[index + +peek.dataset.peek]);
      peek.dataset.id = fish?.id ?? "";
      peek.innerHTML = fish ? fishBodyHTML(fish, startQty(fish.id)) : "";
      for (const el of $$("[id]", peek)) el.removeAttribute("id");
    }
  }

  function stepFish(step, { focus = true } = {}) {
    const order = visibleOrder();
    const next = order[order.indexOf(modal.id) + step];
    if (next === undefined) return;
    openFish(next);
    if (!focus) return;
    // Keep focus on the button that was pressed so repeated presses work;
    // fall back to the other direction once the end is reached.
    const same = $(`[data-step="${step}"]`, fishDialog);
    (same.disabled ? $(`[data-step="${-step}"]`, fishDialog) : same).focus();
  }

  // A sideways swipe anywhere but the photos drags the fish aside, with the
  // previous or next one following it in, and steps once it is let go far
  // enough or flicked. Swipes from the screen edges are left to the browser,
  // which uses them for back and forward. The direction is decided on the
  // first few pixels: a sideways drag stops the panel scrolling, and a
  // vertical one is left to scroll as usual.
  const SWIPE_EDGE = 24;
  const SWIPE_LOCK = 8;
  const SWIPE_FLICK = 0.4; // px per ms
  let swipe = null;
  let settling = false;

  const peekFor = (step) =>
    peeks.find((peek) => +peek.dataset.peek === step && peek.dataset.id);

  fishDialog.addEventListener(
    "touchstart",
    (event) => {
      const [touch] = event.touches;
      swipe =
        !settling &&
        event.touches.length === 1 &&
        !event.target.closest(".gallery__viewport, input, select, textarea") &&
        touch.clientX > SWIPE_EDGE &&
        touch.clientX < innerWidth - SWIPE_EDGE
          ? { x: touch.clientX, y: touch.clientY, dragging: false }
          : null;
    },
    { passive: true },
  );

  fishDialog.addEventListener(
    "touchmove",
    (event) => {
      if (!swipe) return;
      const [touch] = event.touches;
      const dx = touch.clientX - swipe.x;
      const dy = touch.clientY - swipe.y;
      if (!swipe.dragging) {
        if (Math.hypot(dx, dy) < SWIPE_LOCK) return;
        // Not mostly sideways, already scrolling, or ending a text selection.
        if (
          Math.abs(dx) <= Math.abs(dy) ||
          !event.cancelable ||
          !getSelection().isCollapsed
        ) {
          swipe = null;
          return;
        }
        swipe.dragging = true;
        startDrag();
      }
      event.preventDefault();
      const now = event.timeStamp;
      if (swipe.t !== undefined && now > swipe.t)
        swipe.v = (dx - swipe.dx) / (now - swipe.t);
      swipe.dx = dx;
      swipe.t = now;
      // Resist past the first and last fish.
      const offset = peekFor(dx < 0 ? 1 : -1) ? dx : dx / 3;
      fishTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
    },
    { passive: false },
  );

  fishDialog.addEventListener(
    "touchend",
    () => {
      if (!swipe?.dragging) {
        swipe = null;
        return;
      }
      const { dx, v = 0 } = swipe;
      swipe = null;
      const step = dx < 0 ? 1 : -1;
      const width = fishTrack.clientWidth;
      const go =
        peekFor(step) &&
        (Math.abs(dx) > width / 3 ||
          (Math.abs(v) > SWIPE_FLICK && Math.sign(v) === Math.sign(dx)));
      settle(go ? -step * width : 0, go ? step : 0);
    },
    { passive: true },
  );

  fishDialog.addEventListener(
    "touchcancel",
    () => {
      if (swipe?.dragging) settle(0, 0);
      swipe = null;
    },
    { passive: true },
  );

  // The neighbours show their tops in the visible part of the panel, as they
  // will look once stepped to, however far the current fish is scrolled.
  function startDrag() {
    const bar = $(".product-modal__bar", fishDialog).getBoundingClientRect();
    const track = fishTrack.getBoundingClientRect();
    const panel = fishPanel.getBoundingClientRect();
    for (const peek of peeks) {
      peek.style.top = `${Math.max(0, bar.bottom - track.top)}px`;
      peek.style.height = `${panel.bottom - Math.max(bar.bottom, track.top)}px`;
    }
    fishTrack.classList.add("is-dragging");
  }

  function settle(offset, step) {
    settling = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      fishTrack.removeEventListener("transitionend", finish);
      fishTrack.classList.remove("is-settling", "is-dragging");
      // Step first, in the same frame as the reset, so the fish that slid
      // in is simply re-rendered in place.
      if (step && fishDialog.open) stepFish(step, { focus: false });
      fishTrack.style.transform = "";
      for (const peek of peeks) peek.style.top = peek.style.height = "";
      settling = false;
    };
    if (reducedMotion()) return finish();
    fishTrack.classList.add("is-settling");
    fishTrack.addEventListener("transitionend", finish);
    setTimeout(finish, 400);
    fishTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
  }

  /* Gallery and lightbox */

  function showPhoto(index, { scroll = true } = {}) {
    const count = byId.get(modal.id).photos.length;
    modal.photo = Math.max(0, Math.min(count - 1, index));
    $(".gallery__counter", fishBody).textContent =
      `${modal.photo + 1} / ${count}`;
    $$(".gallery__thumb", fishBody).forEach((thumb, i) => {
      if (i === modal.photo) thumb.setAttribute("aria-current", "true");
      else thumb.removeAttribute("aria-current");
    });
    $('[data-photo="-1"]', fishBody).disabled = modal.photo === 0;
    $('[data-photo="1"]', fishBody).disabled = modal.photo === count - 1;
    if (scroll) {
      // Behind the lightbox the gallery jumps, so it is already on the
      // right photo when the lightbox closes.
      const viewport = $(".gallery__viewport", fishBody);
      viewport.scrollTo({
        left: modal.photo * viewport.clientWidth,
        behavior: reducedMotion() || lightbox.open ? "auto" : "smooth",
      });
    }
  }

  const lightboxFrame = $(".lightbox__frame", lightbox);

  function openLightbox(index) {
    const fish = byId.get(modal.id);
    showPhoto(index, { scroll: false });
    lightboxFrame.innerHTML = fish.photos
      .map(
        (photo, i) => `<div class="lightbox__slide" role="group" aria-label="Photo ${i + 1} of ${fish.photos.length}">
          <img src="${esc(photo.src)}" alt="${esc(`${fish.name}: ${photo.caption}`)}" decoding="async"${i === modal.photo ? "" : ' loading="lazy"'}>
        </div>`,
      )
      .join("");
    showDialog(lightbox);
    renderLightbox({ smooth: false });
  }

  // Updates the caption and controls, and scrolls the strip to the current
  // photo unless the strip's own scrolling got it there.
  function renderLightbox({ scroll = true, smooth = true } = {}) {
    const fish = byId.get(modal.id);
    const photo = fish.photos[modal.photo];
    if (scroll)
      lightboxFrame.scrollTo({
        left: modal.photo * lightboxFrame.clientWidth,
        behavior: smooth && !reducedMotion() ? "smooth" : "auto",
      });
    $(".lightbox__caption", lightbox).innerHTML = credit(photo);
    $(".lightbox__counter", lightbox).textContent =
      `${modal.photo + 1} / ${fish.photos.length}`;
    $('[data-photo-step="-1"]', lightbox).disabled = modal.photo === 0;
    $('[data-photo-step="1"]', lightbox).disabled =
      modal.photo === fish.photos.length - 1;
  }

  /* Events */

  const isPlainClick = (event) =>
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;

  const CLICK_ACTIONS = [
    [
      "#groups a",
      (el, event) => {
        const target = $(el.hash);
        if (!target || !isPlainClick(event)) return;
        event.preventDefault();
        jumpTo(target);
        history.replaceState(history.state, "", el.hash);
      },
    ],
    [
      "#open-filters",
      () => {
        writeFacetForm();
        showDialog($("#filters"));
      },
    ],
    [
      "#filters-clear",
      () => {
        clearFacets();
        applyView();
      },
    ],
    [
      "[data-clear-facets]",
      () => {
        clearFacets();
        applyView();
        $("#open-filters").focus();
      },
    ],
    [
      "[data-remove-facet]",
      (el) => {
        const id = el.dataset.removeFacet;
        if (id === "price") view.min = view.max = null;
        else {
          const split = id.indexOf(":");
          view.facets.get(id.slice(0, split)).delete(id.slice(split + 1));
        }
        writeFacetForm();
        applyView();
        $("#open-filters").focus();
      },
    ],
    [
      "#clear-all",
      () => {
        $("#q").value = "";
        view.query = "";
        clearFacets();
        applyView();
        $("#q").focus();
      },
    ],
    [
      "[data-quick-add]",
      (el) => {
        const id = +el.dataset.quickAdd;
        if (lines.get(id).selected) removeFromList(id);
        else {
          const title = addedTitle(id);
          addToCart(id);
          showAdded(title);
        }
      },
    ],
    [
      "[data-favourite]",
      (el) => {
        const id = +el.dataset.favourite;
        const { name } = byId.get(id);
        if (isFavourite(id)) {
          setFavourite(id, false);
          showMessage(`${name} removed from favourites`);
          return;
        }
        const inList = lines.get(id).selected;
        setFavourite(id, true);
        showMessage(`${name} ${inList ? "moved" : "added"} to favourites`);
      },
    ],
    [
      "[data-qty-step]",
      (el) => stepQuantity(el),
    ],
    ["[data-remove]", (el) => removeFromList(+el.dataset.remove)],
    [
      "#fish-add",
      () => {
        if (modal.qty === 0) {
          removeFromList(modal.id);
          return;
        }
        const title = addedTitle(modal.id, modal.qty);
        addToCart(modal.id, { qty: modal.qty });
        showAdded(title);
      },
    ],
    ["[data-step]", (el) => stepFish(Number(el.dataset.step))],
    ["[data-photo]", (el) => showPhoto(modal.photo + Number(el.dataset.photo))],
    ["[data-goto]", (el) => showPhoto(Number(el.dataset.goto))],
    [
      "[data-zoom]",
      (el) => openLightbox(Number(el.dataset.zoom)),
    ],
    [
      "[data-photo-step]",
      (el) => {
        showPhoto(modal.photo + Number(el.dataset.photoStep));
        renderLightbox();
      },
    ],
  ];

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const fishLink = target.closest("[data-open-fish]");
    if (fishLink) {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      openFish(+fishLink.dataset.openFish);
      return;
    }
    // Clicks on ::backdrop are dispatched to the dialog element itself. Each
    // panel fills its dialog box, so clicks inside land on a descendant.
    if (target instanceof HTMLDialogElement) {
      target.close();
      return;
    }
    const closer = target.closest("[data-close]");
    if (closer) {
      closer.closest("dialog")?.close();
      return;
    }
    for (const [selector, action] of CLICK_ACTIONS) {
      const el = target.closest(selector);
      if (el) {
        action(el, event);
        return;
      }
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches('[data-qty="fish"]')) setModalQty(target.value);
  });

  $("#filter-form").addEventListener("input", () => {
    readFacetForm();
    applyView();
  });
  $("#filter-form").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  $("#q").addEventListener("input", (event) => {
    view.query = event.target.value.trim().toLowerCase();
    applyView();
  });
  $("#sort").addEventListener("change", (event) => {
    view.sort = SORTS[event.target.value] ? event.target.value : "featured";
    $("#sort-control").classList.toggle("is-active", view.sort !== "featured");
    applyView();
  });

  document.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    if (modal.id === null) return;
    const inLightbox = lightbox.open && lightbox.contains(event.target);
    const inGallery = event.target.closest?.(".gallery__viewport");
    if (!inLightbox && !inGallery) return;
    event.preventDefault();
    const last = byId.get(modal.id).photos.length - 1;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : modal.photo + (event.key === "ArrowRight" ? 1 : -1);
    showPhoto(index);
    if (inLightbox) renderLightbox();
  });

  // Scroll events fire far more often than frames, so the position is read
  // once per frame. Scroll does not bubble, hence the capture listener.
  let scrollFrame;
  fishDialog.addEventListener(
    "scroll",
    (event) => {
      const viewport = event.target;
      if (
        !viewport.classList?.contains("gallery__viewport") ||
        !fishBody.contains(viewport)
      )
        return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        if (!viewport.clientWidth || modal.id === null) return;
        const index = Math.round(viewport.scrollLeft / viewport.clientWidth);
        if (index !== modal.photo) showPhoto(index, { scroll: false });
      });
    },
    { capture: true, passive: true },
  );

  let lightboxFrameScroll;
  lightboxFrame.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(lightboxFrameScroll);
      lightboxFrameScroll = requestAnimationFrame(() => {
        if (!lightboxFrame.clientWidth || modal.id === null) return;
        const index = Math.round(
          lightboxFrame.scrollLeft / lightboxFrame.clientWidth,
        );
        if (index === modal.photo) return;
        showPhoto(index);
        renderLightbox({ scroll: false });
      });
    },
    { passive: true },
  );
  added.addEventListener("pointerenter", () => clearTimeout(addedTimer));
  added.addEventListener("pointerleave", hideAddedLater);
  added.addEventListener("focusin", () => clearTimeout(addedTimer));
  added.addEventListener("focusout", (event) => {
    if (!added.contains(event.relatedTarget)) hideAddedLater();
  });
  added.addEventListener("toggle", (event) => {
    if (event.newState === "closed") clearTimeout(addedTimer);
  });

  fishDialog.addEventListener("close", () => {
    if (fishDialog.open || "reopening" in fishDialog.dataset) return;
    if (lightbox.open) lightbox.close();
    if (fishDialog.contains(added)) hideAdded();
    modal.id = null;
    // Closed with the button, Escape or the backdrop: step back off the
    // modal's own entry. Closed by going back: the hash is already gone.
    if (history.state?.fish) history.back();
    else if (location.hash.startsWith("#fish-"))
      history.replaceState(history.state, "", pageURL());
  });

  $("#group-sections").addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const img = event.target
      .closest?.(".card")
      ?.querySelector(".card__hover[data-src]");
    if (!img) return;
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
  // Image load events do not bubble, so this listens in the capture phase to
  // cover images added after start up.
  document.addEventListener(
    "load",
    (event) => {
      if (event.target.classList?.contains("card__hover"))
        event.target.classList.add("is-loaded");
    },
    true,
  );
  function syncHash() {
    const match = /^#fish-(\d+)$/.exec(location.hash);
    if (match && byId.has(+match[1])) openFish(+match[1]);
    // Back from an open fish.
    else if (fishDialog.open) fishDialog.close();
  }
  window.addEventListener("hashchange", syncHash);

  // Anchor jumps must land below the sticky toolbar, whose height changes as
  // it wraps and as filter chips come and go.
  const toolbar = $(".toolbar");
  if ("ResizeObserver" in window)
    new ResizeObserver(() => {
      const { style } = document.documentElement;
      style.setProperty("--toolbar-height", `${toolbar.offsetHeight + 16}px`);
      // Where the group headings stick while the toolbar is showing.
      style.setProperty("--toolbar-bottom", `${toolbar.offsetHeight}px`);
    }).observe(toolbar);

  // Like Dawn's header, the toolbar hides while scrolling down and comes back
  // on any scroll up. It stays while a search or sort control has focus.
  let lastY = scrollY;
  let toolbarFrame;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(toolbarFrame);
      toolbarFrame = requestAnimationFrame(() => {
        const y = Math.max(0, scrollY);
        if (Math.abs(y - lastY) < 5) return;
        const editing = document.activeElement?.matches?.(
          ".toolbar input, .toolbar select",
        );
        toolbar.classList.toggle(
          "is-hidden",
          y > lastY && y > toolbar.offsetHeight && !editing,
        );
        lastY = y;
      });
    },
    { passive: true },
  );
  toolbar.addEventListener("focusin", () =>
    toolbar.classList.remove("is-hidden"),
  );

  // Lands the group's heading where it sticks. A jump down hides the toolbar,
  // so only a jump up has to clear it. The heading's own position can't be
  // used, since it may be stuck, so it is worked out from its section.
  function jumpTo(section) {
    const head =
      section.getBoundingClientRect().top +
      scrollY +
      parseFloat(getComputedStyle(section).paddingTop);
    const offset = head > scrollY ? 0 : toolbar.offsetHeight;
    scrollTo({
      top: head - offset,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }

  renderGroups();
  renderFacetForm();
  onCartChange(renderListState);
  renderListState();
  applyView();
  syncHash();
})();
