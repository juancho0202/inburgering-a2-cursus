// Runs before the first paint: does this visit show the landing page or go straight into the app?
// The landing page is only for "/" without a query, on a device that has not started yet. Everyone else gets the
// app, so a bookmark or the home-screen icon opens it directly. The key is shared with src/lib/landing.ts.
(function () {
  var started = false;
  try {
    started = localStorage.getItem("appStarted") === "1";
  } catch (e) {
    // storage blocked: show the landing page; the start link still opens the app
  }
  var landing = location.pathname === "/" && !location.search && !started;
  if (!landing) document.documentElement.classList.add("app");
})();
