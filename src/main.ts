import { hasLocalData, startApp } from "./lib/landing";

// First-time visitors to "/" see the landing page in index.html. The app (code, course, offline copy) is only
// downloaded when it starts: from the landing page's start link, on any other page, or for a returning learner.
const app = () => import("./app");
void startApp(
  async () => (await app()).mountApp(),
  async () => (await hasLocalData()) && (await (await app()).hasSeenWelcome()),
);
