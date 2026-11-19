import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { sitePages } from "../src/pages/site-pages";

const output = path.resolve(import.meta.dirname, "../dist");
const siteOrigin = "https://bin-day.mynameistito.com";
const sitemapUrl = `${siteOrigin}/sitemap.xml`;
const templateTitle = "<title>Hamilton Bin Day</title>";
const indexFile = "index.html";
const template = await readFile(path.join(output, indexFile), "utf-8");
const robotsPath = path.join(output, "robots.txt");
const robots = await readFile(robotsPath, "utf-8");
const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const canonicalLink = (url: string): string =>
  `<link rel="canonical" href="${escapeHtml(url)}">`;

await Promise.all(
  sitePages.map(async ({ component, description, path: routePath, title }) => {
    const url = new URL(routePath, siteOrigin).href;
    const head = [
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}">`,
      canonicalLink(url),
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Hamilton Bin Day">',
      '<meta property="og:locale" content="en_NZ">',
      `<meta property="og:url" content="${escapeHtml(url)}">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
    ].join("\n    ");
    const siteName =
      routePath === "/"
        ? `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Hamilton Bin Day",
            url,
          })}</script>`
        : "";
    const markup = renderToString(createElement(component));
    const html = template
      .replace(templateTitle, () => `${head}\n    ${siteName}`)
      .replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`);
    const directory = path.join(output, routePath);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, indexFile), html);
  })
);

const docsOutput = path.join(output, "docs");
const docsFiles = await readdir(docsOutput, { recursive: true });
const docsUrls = await Promise.all(
  docsFiles
    .filter((file) => path.basename(file) === indexFile)
    .toSorted()
    .map(async (file) => {
      const urlPath = file.split(path.sep).slice(0, -1).join("/");
      const url = new URL(urlPath ? `/docs/${urlPath}/` : "/docs/", siteOrigin)
        .href;
      const documentPath = path.join(docsOutput, file);
      const html = await readFile(documentPath, "utf-8");
      await writeFile(
        documentPath,
        html.replace("</head>", () => `${canonicalLink(url)}</head>`)
      );
      return url;
    })
);

const urls = [
  ...sitePages.map(({ path: route }) => siteOrigin + route),
  ...docsUrls,
];
await Promise.all([
  writeFile(
    path.join(output, "sitemap.xml"),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
      "</urlset>",
      "",
    ].join("\n")
  ),
  writeFile(robotsPath, `${robots.trimEnd()}\n\nSitemap: ${sitemapUrl}\n`),
  writeFile(
    path.join(output, "404.html"),
    template
      .replace(
        templateTitle,
        "<title>Page not found | Hamilton Bin Day</title>"
      )
      .replace(/<script type="module"[^>]*><\/script>/u, "")
      .replace(
        '<div id="root"></div>',
        '<main class="mx-auto max-w-4xl px-5 py-12 text-ink"><h1 class="text-4xl font-semibold">Page not found</h1><p class="mt-4"><a class="underline" href="/">Find your Hamilton bin day</a> or see <a class="underline" href="/what-goes-where/">what goes in each bin</a>.</p></main>'
      )
  ),
]);
