import { existsSync, readFileSync } from "node:fs";

const baseUrl = process.env.UI_VERIFY_BASE_URL ?? "http://localhost:3000";

const routes = [
  { path: "/", label: "Dashboard" },
  { path: "/sets", label: "Sets" },
  { path: "/cards", label: "Cards" },
  { path: "/pricing-audit", label: "Pricing audit" },
  { path: "/sets/base-set", label: "Base Set detail" },
];

function fail(message) {
  console.error(`\nUI verification failed: ${message}`);
  process.exit(1);
}

function assertDashboardRouteFile() {
  const pagePath = "app/page.tsx";

  if (!existsSync(pagePath)) {
    fail("app/page.tsx is missing, so the homepage dashboard route cannot resolve.");
  }

  const pageSource = readFileSync(pagePath, "utf8");

  if (!/export\s+default\s+(async\s+)?function\s+\w+/.test(pageSource)) {
    fail("app/page.tsx exists, but no default page component export was found.");
  }
}

function assertCardDetailRouteFile() {
  const pagePath = "app/cards/[id]/page.tsx";

  if (!existsSync(pagePath)) {
    fail("app/cards/[id]/page.tsx is missing, so card detail links cannot resolve.");
  }

  const pageSource = readFileSync(pagePath, "utf8");

  if (!/export\s+default\s+(async\s+)?function\s+\w+/.test(pageSource)) {
    fail("app/cards/[id]/page.tsx exists, but no default page component export was found.");
  }
}

async function fetchText(url) {
  let response;

  try {
    response = await fetch(url, { redirect: "manual" });
  } catch (error) {
    fail(`could not reach ${url}. Start the app with npm.cmd run dev first. ${error.message}`);
  }

  const text = await response.text();
  return { response, text };
}

function getStylesheetUrls(html) {
  const hrefs = [];
  const linkPattern = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = linkPattern.exec(html))) {
    hrefs.push(match[1]);
  }

  return hrefs;
}

function toAbsoluteUrl(pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

async function getCombinedCss(html) {
  const stylesheetUrls = getStylesheetUrls(html);

  if (stylesheetUrls.length === 0) {
    fail("no stylesheet link was found in the rendered HTML.");
  }

  const cssResponses = await Promise.all(
    stylesheetUrls.map(async (href) => {
      const cssUrl = toAbsoluteUrl(href);
      const { response, text } = await fetchText(cssUrl);

      if (!response.ok) {
        fail(`stylesheet ${cssUrl} returned HTTP ${response.status}.`);
      }

      return text;
    }),
  );

  return cssResponses.join("\n");
}

function assertCssIsActive(css) {
  if (css.includes("@tailwind")) {
    fail("global CSS still contains raw @tailwind directives, so PostCSS/Tailwind did not compile.");
  }

  const hasGlobalBackground = css.includes("backgrounds/neon_bg1.png");
  const hasProjectCss = css.includes(".neon-panel");
  const hasTailwindUtility = css.includes(".mx-auto") || css.includes(".grid") || css.includes(".flex");

  if (!hasGlobalBackground) {
    fail("compiled CSS does not include the global neon background asset.");
  }

  if (!hasProjectCss) {
    fail("compiled CSS does not include project global classes such as .neon-panel.");
  }

  if (!hasTailwindUtility) {
    fail("compiled CSS does not include expected Tailwind utility classes.");
  }
}

function assertHtmlLooksStyled(html, routeLabel) {
  if (!html.includes("__next")) {
    fail(`${routeLabel} did not render a Next.js app document.`);
  }

  if (!html.includes("class=")) {
    fail(`${routeLabel} rendered without class attributes, which suggests plain HTML output.`);
  }

  if (!html.includes("neon-panel") && !html.includes("mx-auto")) {
    fail(`${routeLabel} rendered without expected styled app classes.`);
  }
}

async function verifyRoute(route) {
  const url = toAbsoluteUrl(route.path);
  const { response, text: html } = await fetchText(url);

  if (response.status === 404) {
    fail(`${route.label} at ${route.path} returned 404.`);
  }

  if (!response.ok) {
    fail(`${route.label} at ${route.path} returned HTTP ${response.status}.`);
  }

  assertHtmlLooksStyled(html, route.label);

  const css = await getCombinedCss(html);
  assertCssIsActive(css);

  console.log(`ok ${route.path} (${route.label})`);
}

async function verifyCardDetailRoute() {
  const cardsUrl = toAbsoluteUrl("/cards");
  const { response, text: cardsHtml } = await fetchText(cardsUrl);

  if (!response.ok) {
    fail(`could not discover a card detail link because /cards returned HTTP ${response.status}.`);
  }

  const detailPath = cardsHtml.match(/href=["'](\/cards\/\d+)["']/)?.[1];

  if (!detailPath) {
    fail("no numeric card detail link was found in the rendered /cards page.");
  }

  await verifyRoute({ path: detailPath, label: "Card detail" });
}

assertDashboardRouteFile();
assertCardDetailRouteFile();

for (const route of routes) {
  await verifyRoute(route);
}

await verifyCardDetailRoute();

console.log("\nUI verification passed: homepage, set list, card list, set detail, card detail, and compiled Tailwind/global CSS are healthy.");
