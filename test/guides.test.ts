import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pagesGuides } from "../src/guides.ts";
import type { Donnees } from "../src/site.ts";
import { pageAccueil } from "../src/site.ts";
import { GUIDES } from "../src/guides.ts";

function donneesReelles(): Donnees {
  const lire = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
  return {
    corridors: lire("data/corridors.json"),
    fournisseurs: lire("data/fournisseurs.json").fournisseurs,
    taux: lire("data/taux.json"),
    aujourdHui: new Date("2026-11-10T12:00:00Z"),
    nomSite: "Test",
  };
}

test("les guides se génèrent avec les vraies données, sans valeur manquante", () => {
  const pages = pagesGuides(donneesReelles());
  assert.equal(pages.length, 3);
  for (const p of pages) {
    assert.ok(p.chemin.startsWith("guides/") && p.chemin.endsWith("/"));
    assert.doesNotMatch(p.html, /NaN|undefined|\[object Object\]/);
    assert.match(p.html, /<h1>/);
    assert.match(p.html, /FCFA|XOF|XAF/);
  }
});

test("la page d'accueil liste les guides", () => {
  const html = pageAccueil(donneesReelles(), GUIDES);
  for (const g of GUIDES) assert.ok(html.includes(g.chemin));
});
