// Génération du site statique (HTML pur + un petit calculateur en JavaScript).
import type { Fournisseur, Resultat } from "./calcul.ts";
import { classer, formater, tarifPour, tauxReference, JOURS_AVANT_PEREMPTION } from "./calcul.ts";

export type Origine = { code: string; nom: string; de: string; devise: string };
export type Destination = { code: string; nom: string; au: string; devise: string; modes: string[]; portefeuilles: string[] };
export type Corridors = {
  parites_fixes: Record<string, { euro: number; nom: string }>;
  origines: Origine[];
  destinations: Destination[];
  montants_exemples: number[];
};
export type Donnees = {
  corridors: Corridors;
  fournisseurs: Fournisseur[];
  taux: { date: string; rates: Record<string, number>; source: string };
  aujourdHui: Date;
  nomSite: string;
};

// Chemin de base du site : "/" en local, "/comparateur-transferts/" sur GitHub Pages (variable BASE_URL).
export const BASE = (process.env.BASE_URL || "/").replace(/\/?$/, "/");

// Adresse publique complète du site (variable SITE_URL), pour les liens canoniques et le plan du site.
export const SITE_URL = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/?$/, "/") : "";

export const MODES: Record<string, string> = { mobile: "Mobile money", especes: "Retrait en espèces", banque: "Compte bancaire" };

export function echapper(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** JSON sûr à insérer dans une balise <script>. */
function jsonScript(v: unknown): string {
  const ls = String.fromCharCode(0x2028), ps = String.fromCharCode(0x2029);
  return JSON.stringify(v).replace(/</g, "\\u003c").split(ls).join("\\u2028").split(ps).join("\\u2029");
}

export function slug(o: Origine, d: Destination): string {
  const s = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${s(o.nom)}-${s(d.nom)}`;
}

const STYLE = `
:root{--fond:#f6f4ef;--carte:#fff;--texte:#1c1f1d;--doux:#5b625d;--accent:#0d6e4f;--accent-doux:#e3f1ea;--bord:#dcd7cc;--alerte:#9a5b00}
@media (prefers-color-scheme:dark){:root{--fond:#121513;--carte:#1b201d;--texte:#e8ebe8;--doux:#9ba39d;--accent:#43c08f;--accent-doux:#173327;--bord:#2b322d;--alerte:#e0a64a}}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--fond);color:var(--texte)}
header,main,footer{max-width:820px;margin:0 auto;padding:16px}header a{color:var(--texte);text-decoration:none;font-weight:700}
h1{font-size:1.6rem;line-height:1.2;margin:12px 0 8px}h2{font-size:1.15rem;margin:28px 0 8px}a{color:var(--accent)}
.doux{color:var(--doux);font-size:.92rem}.carte{background:var(--carte);border:1px solid var(--bord);border-radius:14px;padding:16px}
.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.grille a{text-decoration:none;color:inherit}
.grille .carte:hover{border-color:var(--accent)}.gros{font-size:1.4rem;font-weight:700}
form{display:flex;gap:12px;flex-wrap:wrap;align-items:end}label{display:flex;flex-direction:column;font-size:.9rem;gap:4px}
input,select{font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--bord);background:var(--carte);color:var(--texte);min-width:0}
table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid var(--bord);text-align:left;vertical-align:top}
td.n,th.n{text-align:right;white-space:nowrap}tr.premier td{background:var(--accent-doux)}
.bouton{display:inline-block;background:var(--accent);color:#fff;border-radius:999px;padding:6px 14px;text-decoration:none;font-size:.9rem;white-space:nowrap}
@media (prefers-color-scheme:dark){.bouton{color:#0b130f}}.etiquette{font-size:.75rem;color:var(--doux)}.perime{color:var(--alerte);font-size:.8rem}
.defile{overflow-x:auto}footer{font-size:.85rem;color:var(--doux)}
.mobile-seul{display:none}
@media (max-width:560px){th:nth-child(3),td:nth-child(3),th:nth-child(5),td:nth-child(5){display:none}th,td{padding:8px 4px}.mobile-seul{display:inline-block;margin-top:8px}td.n{white-space:normal}th{font-size:.85rem}}
`;

// Bannière affichée tant que les tarifs des fournisseurs sont fictifs (voir data/fournisseurs.json).
let banniere = "";
export function definirBanniere(texte: string | undefined): void {
  banniere = texte ? `<div style="background:var(--alerte);color:#fff;padding:8px 16px;text-align:center;font-size:.9rem">${echapper(texte)}</div>` : "";
}

export function page(titre: string, description: string, nomSite: string, corps: string, chemin = ""): string {
  const canonique = SITE_URL ? `<link rel="canonical" href="${SITE_URL}${chemin}"><meta property="og:url" content="${SITE_URL}${chemin}">` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)}</title><meta name="description" content="${echapper(description)}">${canonique}
<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="${echapper(titre)}"><meta property="og:description" content="${echapper(description)}">
<style>${STYLE}</style></head>
<body>${banniere}<header><a href="${BASE}">${echapper(nomSite)}</a></header><main>${corps}</main>
<footer><p>Comparateur indépendant et gratuit. Certains liens sont rémunérés : cela ne change jamais le classement, toujours trié par montant reçu. <a href="${BASE}methode/">Notre méthode</a>.</p>
<p>Taux de référence : Banque centrale européenne. Vérifiez toujours le montant final chez le fournisseur avant d'envoyer.</p></footer></body></html>`;
}

function lignesTableau(resultats: Resultat[], devEnvoi: string, devRecue: string): string {
  if (resultats.length === 0) return `<tr><td colspan="5" class="doux">Aucun tarif relevé pour ce trajet et ce mode pour l'instant.</td></tr>`;
  return resultats
    .map((r, i) => {
      const f = r.fournisseur;
      const rel = f.affilie ? "sponsored nofollow noopener" : "nofollow noopener";
      return `<tr class="${i === 0 ? "premier" : ""}"><td><strong>${echapper(f.nom)}</strong><br><span class="etiquette">${f.modes.map((m) => MODES[m] ?? m).join(" · ")} · ${echapper(f.delai)}</span>${f.note ? `<br><span class="etiquette">${echapper(f.note)}</span>` : ""}${
        r.perime ? `<br><span class="perime">Tarif relevé le ${echapper(f.releve_le)} : à vérifier</span>` : ""
      }<br><a class="bouton mobile-seul" href="${echapper(f.lien)}" rel="${rel}" target="_blank">Voir l'offre</a>${
        f.affilie ? `<span class="etiquette mobile-seul">&nbsp;lien rémunéré</span>` : ""
      }</td>
<td class="n"><strong>${formater(r.montantRecu)} ${devRecue}</strong></td>
<td class="n">${formater(r.frais, 2)} ${devEnvoi}</td>
<td class="n">${formater(r.coutPourcent, 1)} %</td>
<td class="n"><a class="bouton" href="${echapper(f.lien)}" rel="${rel}" target="_blank">Voir l'offre</a>${f.affilie ? `<br><span class="etiquette">lien rémunéré</span>` : ""}</td></tr>`;
    })
    .join("");
}

// Le même calcul que calcul.ts, en JavaScript pour le navigateur (vérifié par les tests).
export const CALCUL_NAVIGATEUR = `
function calculerTous(montant, devEnvoi, destination, mode, tauxRef, fournisseurs, aujourdHui) {
  var res = [];
  fournisseurs.forEach(function (f) {
    var t = f.tarifs[devEnvoi + "-" + destination] || f.tarifs[devEnvoi];
    if (!t || !(montant > 0) || f.destinations.indexOf(destination) < 0) return;
    if (mode && f.modes.indexOf(mode) < 0) return;
    var frais = Math.round((t.frais_fixes + montant * t.frais_pourcent / 100) * 100) / 100;
    if (frais >= montant) return;
    var taux = tauxRef * (1 - t.marge_change_pourcent / 100);
    var recu = Math.floor((montant - frais) * taux);
    var cout = Math.round((montant - recu / tauxRef) * 100) / 100;
    var jours = Math.floor((aujourdHui - Date.parse(f.releve_le + "T00:00:00Z")) / 86400000);
    res.push({ f: f, frais: frais, recu: recu, coutPourcent: Math.round(cout / montant * 1000) / 10, perime: jours > ${JOURS_AVANT_PEREMPTION} });
  });
  res.sort(function (a, b) { return b.recu - a.recu || a.f.nom.localeCompare(b.f.nom); });
  return res;
}`;

export function pageCorridor(d: Donnees, o: Origine, dest: Destination): string {
  const tauxRef = tauxReference(o.devise, dest.devise, d.taux.rates, d.corridors.parites_fixes);
  const montant = 200;
  // Remarque propre au trajet (notes["CAD-CI"]) si elle existe, sinon la remarque générale du fournisseur.
  const fournisseursPage = d.fournisseurs.map((f) => ({ ...f, note: f.notes?.[`${o.devise}-${dest.code}`] ?? f.note }));
  const resultats = classer(montant, o.devise, dest.code, null, tauxRef, fournisseursPage, d.aujourdHui);
  const meilleur = resultats[0];
  const fournisseursCorridor = fournisseursPage.filter((f) => f.destinations.includes(dest.code) && tarifPour(f, o.devise, dest.code));
  const titre = `Envoyer de l'argent ${o.de} ${dest.au} : comparatif des frais du jour`;
  const description = `Comparez ce que reçoit votre famille ${dest.au} pour un envoi ${o.de} : frais, taux de change et marge cachée, sur ${dest.portefeuilles.join(", ")} ou en espèces.`;
  const options = dest.modes.map((m) => `<option value="${m}">${MODES[m] ?? m}</option>`).join("");

  return page(
    titre,
    description,
    d.nomSite,
    `<h1>Envoyer de l'argent ${echapper(o.de)} ${echapper(dest.au)}</h1>
<p>Taux de référence du ${echapper(d.taux.date)} : <strong>1 ${o.devise} = ${formater(tauxRef, 2)} ${dest.devise}</strong> (Banque centrale européenne${
      d.corridors.parites_fixes[dest.devise] ? ", parité fixe du franc CFA avec l'euro" : ""
    }).</p>
${
  meilleur
    ? `<p class="carte">Pour ${montant} ${o.devise}, la meilleure offre du jour fait recevoir <strong>${formater(meilleur.montantRecu)} ${dest.devise}</strong> (${echapper(
        meilleur.fournisseur.nom,
      )}). La moins bonne : ${formater(resultats.at(-1)!.montantRecu)} ${dest.devise}, soit ${formater(meilleur.montantRecu - resultats.at(-1)!.montantRecu)} ${dest.devise} de moins.</p>`
    : ""
}
<h2>Calculer</h2>
<form id="calc" onsubmit="return false"><label>Montant envoyé (${o.devise})<input id="montant" type="number" min="1" step="1" value="${montant}" inputmode="decimal"></label>
<label>Mode de réception<select id="mode"><option value="">Tous</option>${options}</select></label></form>
<div class="defile" style="margin-top:12px"><table><thead><tr><th>Fournisseur</th><th class="n">Reçu par la famille</th><th class="n">Frais</th><th class="n">Coût total</th><th></th></tr></thead>
<tbody id="resultats">${lignesTableau(resultats, o.devise, dest.devise)}</tbody></table></div>
<p class="doux">« Coût total » = frais + marge cachée dans le taux de change, en pourcentage du montant envoyé. Les tarifs sont relevés chez chaque fournisseur ; ceux de plus de ${JOURS_AVANT_PEREMPTION} jours sont signalés.</p>
<h2>Bon à savoir</h2>
<ul><li>Portefeuilles mobiles courants ${echapper(dest.au)} : ${dest.portefeuilles.map(echapper).join(", ")}.</li>
<li>Un transfert « sans frais » n'est pas gratuit : la marge est souvent cachée dans le taux de change. Comparez toujours le montant reçu.</li>
<li>Le ${echapper(d.corridors.parites_fixes[dest.devise]?.nom ?? dest.devise)} a un taux fixe par rapport à l'euro : 1 € = ${formater(d.corridors.parites_fixes[dest.devise]?.euro ?? 0, 3)} ${dest.devise}.</li></ul>
<script>
var DONNEES = ${jsonScript({ fournisseurs: fournisseursCorridor, tauxRef, devEnvoi: o.devise, devRecue: dest.devise, destination: dest.code, modes: MODES })};
${CALCUL_NAVIGATEUR}
(function () {
  var fmt = function (n, d) { return n.toLocaleString("fr-FR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var esc = function (t) { var e = document.createElement("span"); e.textContent = t; return e.innerHTML; };
  var recalculer = function () {
    var m = parseFloat(document.getElementById("montant").value);
    var mode = document.getElementById("mode").value || null;
    var res = calculerTous(m, DONNEES.devEnvoi, DONNEES.destination, mode, DONNEES.tauxRef, DONNEES.fournisseurs, Date.now());
    var corps = document.getElementById("resultats");
    if (!res.length) { corps.innerHTML = '<tr><td colspan="5" class="doux">Aucun tarif relevé pour ce trajet et ce mode pour l\\u2019instant.</td></tr>'; return; }
    corps.innerHTML = res.map(function (r, i) {
      var rel = r.f.affilie ? "sponsored nofollow noopener" : "nofollow noopener";
      return '<tr class="' + (i === 0 ? "premier" : "") + '"><td><strong>' + esc(r.f.nom) + '</strong><br><span class="etiquette">' +
        r.f.modes.map(function (x) { return DONNEES.modes[x] || x; }).join(" · ") + " · " + esc(r.f.delai) + "</span>" + (r.f.note ? '<br><span class="etiquette">' + esc(r.f.note) + "</span>" : "") +
        (r.perime ? '<br><span class="perime">Tarif relevé le ' + esc(r.f.releve_le) + " : à vérifier</span>" : "") +
        '<br><a class="bouton mobile-seul" href="' + esc(r.f.lien) + '" rel="' + rel + '" target="_blank">Voir l\\u2019offre</a>' +
        (r.f.affilie ? '<span class="etiquette mobile-seul">&nbsp;lien rémunéré</span>' : "") +
        '</td><td class="n"><strong>' + fmt(r.recu) + " " + DONNEES.devRecue + '</strong></td><td class="n">' + fmt(r.frais, 2) + " " + DONNEES.devEnvoi +
        '</td><td class="n">' + fmt(r.coutPourcent, 1) + ' %</td><td class="n"><a class="bouton" href="' + esc(r.f.lien) + '" rel="' + rel +
        '" target="_blank">Voir l\\u2019offre</a>' + (r.f.affilie ? '<br><span class="etiquette">lien rémunéré</span>' : "") + "</td></tr>";
    }).join("");
  };
  document.getElementById("montant").addEventListener("input", recalculer);
  document.getElementById("mode").addEventListener("change", recalculer);
})();
</script>`,
    `${slug(o, dest)}/`,
  );
}

export type LienGuide = { titre: string; resume: string; chemin: string };

export function pageAccueil(d: Donnees, guides: LienGuide[] = []): string {
  const cartes = d.corridors.origines
    .flatMap((o) =>
      d.corridors.destinations.map((dest) => {
        const tauxRef = tauxReference(o.devise, dest.devise, d.taux.rates, d.corridors.parites_fixes);
        const meilleur = classer(200, o.devise, dest.code, null, tauxRef, d.fournisseurs, d.aujourdHui)[0];
        return `<a href="${BASE}${slug(o, dest)}/"><div class="carte"><div class="doux">${echapper(o.nom)} → ${echapper(dest.nom)}</div>
<div class="gros">${meilleur ? `${formater(meilleur.montantRecu)} ${dest.devise}` : "—"}</div><div class="doux">reçus au mieux pour 200 ${o.devise}</div></div></a>`;
      }),
    )
    .join("");
  return page(
    `${d.nomSite} : comparez les frais pour envoyer de l'argent en Afrique`,
    "Comparez chaque jour ce que reçoit votre famille en Afrique francophone : frais, taux de change et marge cachée des services de transfert.",
    d.nomSite,
    `<h1>Envoyez plus, payez moins de frais</h1>
<p>Chaque jour, on compare ce que reçoit vraiment votre famille, frais et marge cachée sur le taux de change compris. Gratuit et indépendant.</p>
<p class="doux">Taux de référence de la Banque centrale européenne du ${echapper(d.taux.date)}.</p>
<div class="grille">${cartes}</div>${
      guides.length
        ? `<h2>Guides</h2><ul>${guides.map((g) => `<li><a href="${BASE}${g.chemin}">${echapper(g.titre)}</a><br><span class="doux">${echapper(g.resume)}</span></li>`).join("")}</ul>`
        : ""
    }`,
    "",
  );
}

export function pageMethode(d: Donnees): string {
  return page(
    `Notre méthode · ${d.nomSite}`,
    "Comment le comparateur calcule et classe les offres de transfert d'argent.",
    d.nomSite,
    `<h1>Notre méthode</h1>
<ol><li><strong>Taux de référence</strong> : chaque jour ouvrable, le taux publié par la Banque centrale européenne. Pour le franc CFA, la parité fixe de 1 € = 655,957 FCFA.</li>
<li><strong>Tarifs des fournisseurs</strong> : frais et taux de change relevés chez chaque fournisseur. La date du relevé est affichée ; au-delà de ${JOURS_AVANT_PEREMPTION} jours, le tarif est signalé « à vérifier ».</li>
<li><strong>Montant reçu</strong> = (montant envoyé − frais) × taux du fournisseur, arrondi à l'unité inférieure.</li>
<li><strong>Coût total</strong> = ce que vous perdez par rapport au taux de référence sans frais, en pourcentage du montant envoyé.</li>
<li><strong>Classement</strong> : toujours par montant reçu, du plus élevé au plus bas.</li></ol>
<h2>Comment le site est financé</h2>
<p>Certains fournisseurs nous versent une commission quand vous devenez leur client par nos liens (marqués « lien rémunéré »). Cela ne coûte rien de plus et ne change jamais le classement. Les fournisseurs qui ne paient pas sont comparés de la même façon.</p>`,
    "methode/",
  );
}

export function alerteDuJour(d: Donnees): string {
  const lignes = [`Meilleurs envois du ${d.taux.date} pour 200 (montant reçu par la famille) :`];
  for (const o of d.corridors.origines) {
    for (const dest of d.corridors.destinations) {
      const tauxRef = tauxReference(o.devise, dest.devise, d.taux.rates, d.corridors.parites_fixes);
      const m = classer(200, o.devise, dest.code, null, tauxRef, d.fournisseurs, d.aujourdHui)[0];
      if (m) lignes.push(`${o.nom} → ${dest.nom} : ${formater(m.montantRecu)} ${dest.devise} avec ${m.fournisseur.nom}`);
    }
  }
  lignes.push("Détails et calculateur : voir le site.");
  return lignes.join("\n") + "\n";
}
