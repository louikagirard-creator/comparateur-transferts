// Mise à jour quotidienne : taux BCE → calculs → site statique dans dist/.
// Usage : node src/mettre-a-jour.ts            (télécharge les taux du jour)
//         node src/mettre-a-jour.ts --hors-ligne (utilise les derniers taux enregistrés)
import fs from "node:fs";
import path from "node:path";
import type { Fournisseur } from "./calcul.ts";
import type { Corridors, Donnees } from "./site.ts";
import { alerteDuJour, definirBanniere, pageAccueil, pageCorridor, pageMethode, slug } from "./site.ts";
import { enregistrerTaux, lireTauxEnCache, telechargerTaux } from "./taux.ts";

const SORTIE = "dist";
const NOM_SITE = process.env.NOM_SITE || "Envoi Malin (prototype)";

function lireJson<T>(fichier: string): T {
  return JSON.parse(fs.readFileSync(fichier, "utf8")) as T;
}

function ecrire(chemin: string, contenu: string): void {
  const complet = path.join(SORTIE, chemin);
  fs.mkdirSync(path.dirname(complet), { recursive: true });
  fs.writeFileSync(complet, contenu);
}

async function principal(): Promise<void> {
  const corridors = lireJson<Corridors>("data/corridors.json");
  const { fournisseurs, _bandeau } = lireJson<{ fournisseurs: Fournisseur[]; _bandeau?: string }>("data/fournisseurs.json");
  // Le champ _bandeau du fichier s'affiche en haut de chaque page (ex. « relevé partiel »). Le retirer pour ne plus rien afficher.
  definirBanniere(_bandeau);

  // Devises dont il faut le taux BCE (toutes sauf l'euro et les monnaies à parité fixe).
  const devises = [...new Set([...corridors.origines.map((o) => o.devise), ...corridors.destinations.map((d) => d.devise)])].filter(
    (d) => d !== "EUR" && !corridors.parites_fixes[d],
  );

  let taux = lireTauxEnCache();
  if (!process.argv.includes("--hors-ligne")) {
    try {
      taux = await telechargerTaux(devises);
      enregistrerTaux(taux);
      console.log(`Taux BCE du ${taux.date} téléchargés.`);
    } catch (e) {
      if (!taux) throw e;
      console.warn(`Taux du jour indisponibles (${(e as Error).message}) : utilisation des taux du ${taux.date}.`);
    }
  }
  if (!taux) throw new Error("Aucun taux disponible : lancez une première fois sans --hors-ligne.");

  const donnees: Donnees = { corridors, fournisseurs, taux, aujourdHui: new Date(), nomSite: NOM_SITE };

  fs.rmSync(SORTIE, { recursive: true, force: true });
  ecrire("index.html", pageAccueil(donnees));
  ecrire("methode/index.html", pageMethode(donnees));
  let pages = 2;
  for (const o of corridors.origines) {
    for (const d of corridors.destinations) {
      ecrire(`${slug(o, d)}/index.html`, pageCorridor(donnees, o, d));
      pages++;
    }
  }
  ecrire("alerte-du-jour.txt", alerteDuJour(donnees));
  console.log(`${pages} pages générées dans ${SORTIE}/, plus l'alerte du jour.`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
