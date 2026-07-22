import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the anonymous game start experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Play with pointer/);
  assert.match(html, /Camera stays on this device/);
  assert.match(html, /morning-star-hero\.png/);
  assert.match(html, />KO</);
  assert.match(html, />EN</);
  assert.match(html, /https:\/\/github\.com\/ahndohun\/manse-game-morning-star-catch/);
  assert.doesNotMatch(html, /replace-me/);
  assert.doesNotMatch(html, /signin-with-chatgpt|<iframe\b|<form\b/i);
});

test("ships a locale-aware full-strength game renderer", async () => {
  const source = await readFile("app/themed-renderer.ts", "utf8");
  assert.doesNotMatch(source, /createDefaultRenderer/);
  assert.match(source, /morning-star-hero\.png/);
  assert.match(source, /drawImageCover/);
  assert.match(source, /implements RuntimeRenderer/);
  assert.match(source, /drawVideoCover\(context, frame\.video,[\s\S]*frame\.mirror\)/);
  assert.match(source, /drawNightSet/);
  assert.match(source, /createMorningStarRendererFactory\(locale: GameLocale\)/);
  assert.match(source, /CONSTELLATION COMPLETE/);
  assert.match(source, /별자리 완성/);
});

test("connects the compact platform shell to the exact public Showcase", async () => {
  const response = await render();
  const html = await response.text();
  const showcaseUrl = "https://manse-showcase.ran584000.chatgpt.site";
  assert.equal(html.match(new RegExp(`href="${showcaseUrl}"`, "g"))?.length, 2);
  assert.match(html, />MANSE</);
  assert.match(html, />Browse games</);

  const client = await readFile("app/GameClient.tsx", "utf8");
  assert.match(client, /browseGames: "게임 둘러보기"/);
  assert.match(client, /browseGames: "Browse games"/);

  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.platform-shell\s*\{[\s\S]*?height:\s*68px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.platform-shell\s*\{\s*height:\s*64px/);
  assert.match(css, /\.platform-shell-inner\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.platform-browse\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.platform-shell-inner\s*\{[^}]*overflow:\s*hidden/);
});

test("build bundles the public contract and pose runtime", async () => {
  const manifest = JSON.parse(await readFile("public/.well-known/manse-game.json", "utf8"));
  assert.equal(typeof manifest.slug, "string");
  assert.equal(manifest.slug.length > 0, true);
  assert.equal(manifest.sourceUrl, "https://github.com/ahndohun/manse-game-morning-star-catch");
  await access(`public/packs/${manifest.slug}/manse.pack.json`);
  await access(`public/packs/${manifest.slug}/assets/images/morning-star-hero.png`);
  await access("dist/client/sw.js");
  await access("dist/client/models/pose_landmarker_lite.task");
  await access("dist/client/vendor/mediapipe/wasm/vision_wasm_internal.wasm");
  const clientEntries = await readdir("dist/client", { recursive: true });
  const scripts = await Promise.all(
    clientEntries.filter((entry) => entry.endsWith(".js")).map((entry) => readFile(`dist/client/${entry}`, "utf8")),
  );
  assert.equal(
    scripts.some((script) => script.includes("serviceWorker") && script.includes("/sw.js")),
    true,
    "the production client must register the bundled service worker",
  );
});
