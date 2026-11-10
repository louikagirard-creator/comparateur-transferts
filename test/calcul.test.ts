import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import type { Fournisseur } from "../src/calcul.ts";
import { calculer, classer, tauxReference } from "../src/calcul.ts";
import { CALCUL_NAVIGATEUR, echapper, pageCorridor, slug } from "../src/site.ts";
import type { Corridors } from "../src/site.ts";

const PARITES = { XOF: { euro: 655.957, nom: "franc CFA" }, XAF: { euro: 655.957, nom: "franc CFA" } };
const BCE = { CAD: 1.5, USD: 1.1 };
const AUJ = new Date("2026-11-10T12:00:00Z");

function f(id: string, frais: number, pct: number, marge: number, extra: Partial<Fournisseur> = {}): Fournisseur {
  return {
    id,
    nom: id,
    lien: `https://exemple.invalid/${id}`,
    affilie: true,
    releve_le: "2026-11-09",
    tarifs: { CAD: { frais_fixes: frais, frais_pourcent: pct, marge_change_pourcent: marge } },
    modes: ["mobile"],
    destinations: ["SN"],
    delai: "minutes",
    ...extra,
  };
}

test("taux de référence : parité fixe du franc CFA et taux croisés", () => {
  assert.equal(tauxReference("EUR", "XOF", BCE, PARITES), 655.957);
  assert.equal(tauxReference("CAD", "XOF", BCE, PARITES), 655.957 / 1.5);
  assert.equal(tauxReference("CAD", "USD", BCE, PARITES), 1.1 / 1.5);
  assert.throws(() => tauxReference("CAD", "HTG", BCE, PARITES), /inconnu/);
});

test("montant reçu et coût total", () => {
  // 200 CAD, 2 CAD de frais + 1 %, marge de 2 % ; taux de référence 400
  const r = calculer(200, "CAD", "SN", 400, f("a", 2, 1, 2), AUJ)!;
  assert.equal(r.frais, 4);
  assert.equal(r.montantRecu, Math.floor(196 * 392));
  assert.equal(r.coutTotal, Math.round((200 - r.montantRecu / 400) * 100) / 100);
  // 200 − 76 832 / 400 = 7,92 CAD perdus, soit 4,0 % du montant envoyé
  assert.equal(r.coutTotal, 7.92);
  assert.equal(r.coutPourcent, 4);
  assert.equal(r.perime, false);
});

test("cas limites : frais supérieurs au montant, devise absente, tarif périmé", () => {
  assert.equal(calculer(3, "CAD", "SN", 400, f("a", 5, 0, 0), AUJ), null);
  assert.equal(calculer(100, "EUR", "SN", 655, f("a", 1, 0, 0), AUJ), null);
  assert.equal(calculer(0, "CAD", "SN", 400, f("a", 0, 0, 0), AUJ), null);
  assert.equal(calculer(100, "CAD", "SN", 400, f("a", 0, 0, 1, { releve_le: "2026-10-01" }), AUJ)!.perime, true);
});

test("un tarif propre au trajet l'emporte sur le tarif de la devise", () => {
  const fo = f("a", 5, 0, 3, {
    destinations: ["SN", "CM"],
    tarifs: { CAD: { frais_fixes: 5, frais_pourcent: 0, marge_change_pourcent: 3 }, "CAD-SN": { frais_fixes: 1, frais_pourcent: 0, marge_change_pourcent: 1 } },
  });
  assert.equal(calculer(100, "CAD", "SN", 400, fo, AUJ)!.frais, 1);
  assert.equal(calculer(100, "CAD", "CM", 400, fo, AUJ)!.frais, 5);
  const contexte: { calculerTous?: Function } = {};
  vm.runInNewContext(CALCUL_NAVIGATEUR + "\nthis.calculerTous = calculerTous;", contexte);
  const nav = contexte.calculerTous!(100, "CAD", "SN", null, 400, [fo], AUJ.getTime()) as { frais: number }[];
  assert.equal(nav[0].frais, 1);
});

test("classement : par montant reçu, jamais par commission, filtré par destination et mode", () => {
  const liste = [
    f("cher-affilie", 10, 0, 3, { affilie: true }),
    f("bon-non-affilie", 0, 0, 0.5, { affilie: false }),
    f("autre-pays", 0, 0, 0, { destinations: ["CM"] }),
    f("especes", 0, 0, 0.1, { modes: ["especes"] }),
  ];
  const tous = classer(200, "CAD", "SN", null, 400, liste, AUJ).map((r) => r.fournisseur.id);
  assert.deepEqual(tous, ["especes", "bon-non-affilie", "cher-affilie"]);
  const mobile = classer(200, "CAD", "SN", "mobile", 400, liste, AUJ).map((r) => r.fournisseur.id);
  assert.deepEqual(mobile, ["bon-non-affilie", "cher-affilie"]);
});

test("le calculateur du navigateur donne exactement les mêmes résultats que le serveur", () => {
  const liste = [f("a", 2.99, 0, 1.2), f("b", 0, 1, 1.5), f("c", 9.99, 0, 3.5, { releve_le: "2026-10-01" })];
  const contexte: { calculerTous?: Function } = {};
  vm.runInNewContext(CALCUL_NAVIGATEUR + "\nthis.calculerTous = calculerTous;", contexte);
  for (const montant of [10, 57.5, 200, 1234]) {
    const serveur = classer(montant, "CAD", "SN", null, 437.3, liste, AUJ);
    const navigateur = contexte.calculerTous!(montant, "CAD", "SN", null, 437.3, liste, AUJ.getTime()) as {
      f: Fournisseur; recu: number; frais: number; coutPourcent: number; perime: boolean;
    }[];
    // Les tableaux venant de l'autre contexte vm n'ont pas le même prototype : on compare leur contenu.
    assert.deepEqual(
      JSON.parse(JSON.stringify(navigateur.map((r) => [r.f.id, r.recu, r.frais, r.coutPourcent, r.perime]))),
      serveur.map((r) => [r.fournisseur.id, r.montantRecu, r.frais, r.coutPourcent, r.perime]),
    );
  }
});

test("la page échappe les noms et marque les liens rémunérés", () => {
  const corridors: Corridors = {
    parites_fixes: PARITES,
    origines: [{ code: "CA", nom: "Canada", de: "du Canada", devise: "CAD" }],
    destinations: [{ code: "SN", nom: "Sénégal", au: "au Sénégal", devise: "XOF", modes: ["mobile"], portefeuilles: ["Wave"] }],
    montants_exemples: [200],
  };
  const pire = f("x", 0, 0, 1, { nom: "<script>alert(1)</script>" });
  const html = pageCorridor(
    { corridors, fournisseurs: [pire], taux: { date: "2026-11-09", rates: BCE, source: "BCE" }, aujourdHui: AUJ, nomSite: "Test" },
    corridors.origines[0],
    corridors.destinations[0],
  );
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes(echapper("<script>alert(1)</script>")) || html.includes("\\u003cscript"));
  // Le JavaScript de la page doit être valide (une apostrophe mal placée casse le calculateur).
  for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new vm.Script(code));
  const vide = pageCorridor(
    { corridors, fournisseurs: [], taux: { date: "2026-11-09", rates: BCE, source: "BCE" }, aujourdHui: AUJ, nomSite: "Test" },
    corridors.origines[0],
    corridors.destinations[0],
  );
  for (const [, code] of vide.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new vm.Script(code));
  assert.match(html, /rel="sponsored nofollow noopener"/);
  assert.match(html, /lien rémunéré/);
  assert.equal(slug(corridors.origines[0], corridors.destinations[0]), "canada-senegal");
});
