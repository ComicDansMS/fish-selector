// Fish catalogue rendered by app.js.
//
// Fish ids key saved lists in localStorage and deep links (#fish-12), so an
// existing id must never be renumbered or reused; give new fish the next
// unused number.
//
// Prices are integer cents (null means no listed price). `was` is the
// pre-sale price when a sale was running. `checked` is when the listing was
// last checked, as YYYY-MM or YYYY-MM-DD.
//
// A classic script (not an ES module) so the page still works when opened
// from disk and jsdom can run it in the tests; jsdom skips module scripts.
globalThis.FISH_CATALOGUE = {
  "groups": []
};
