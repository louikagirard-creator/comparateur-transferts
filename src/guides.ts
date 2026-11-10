// Guides pour le référencement. Les chiffres sont calculés à partir des relevés du jour :
// ils restent exacts quand les tarifs ou le taux changent.
import type { Resultat } from "./calcul.ts";
import { classer, formater, tauxReference } from "./calcul.ts";
import type { Destination, Donnees, LienGuide, Origine } from "./site.ts";
import { BASE, echapper, page, slug } from "./site.ts";

type Guide = LienGuide & { html: (d: Donnees) => string };

function trajet(d: Donnees, origine: string, destination: string): { o: Origine; dest: Destination; tauxRef: number } | null {
  const o = d.corridors.origines.find((x) => x.code === origine);
  const dest = d.corridors.destinations.find((x) => x.code === destination);
  if (!o || !dest) return null;
  return { o, dest, tauxRef: tauxReference(o.devise, dest.devise, d.taux.rates, d.corridors.parites_fixes) };
}

function lienTrajet(o: Origine, dest: Destination): string {
  return `<a href="${BASE}${slug(o, dest)}/">comparatif ${echapper(o.de)} ${echapper(dest.au)}</a>`;
}

function tableau(resultats: Resultat[], devEnvoi: string, devRecue: string): string {
  return `<div class="defile"><table><thead><tr><th>Service</th><th class="n">Frais affichés</th><th class="n">Reçu par la famille</th><th class="n">Coût total</th></tr></thead><tbody>${resultats
    .map(
      (r) =>
        `<tr><td>${echapper(r.fournisseur.nom)}</td><td class="n">${formater(r.frais, 2)} ${devEnvoi}</td><td class="n">${formater(r.montantRecu)} ${devRecue}</td><td class="n">${formater(r.coutPourcent, 1)} %</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

const sansFrais: Guide = {
  titre: "« Sans frais » ne veut pas dire gratuit : la marge cachée dans le taux de change",
  resume: "Pourquoi il faut comparer le montant reçu, et pas les frais affichés.",
  chemin: "guides/sans-frais-pas-gratuit/",
  html: (d) => {
    const t = trajet(d, "CA", "CI");
    if (!t) return "";
    const res = classer(200, t.o.devise, t.dest.code, null, t.tauxRef, d.fournisseurs, d.aujourdHui);
    const sansFraisChers = res.filter((r) => r.frais === 0).sort((a, b) => b.coutPourcent - a.coutPourcent)[0];
    const reference = Math.floor(200 * t.tauxRef);
    return `<h1>« Sans frais » ne veut pas dire gratuit</h1>
<p>Beaucoup de services annoncent des transferts « sans frais ». Mais ils gagnent aussi de l'argent sur le <strong>taux de change</strong> : ils vous donnent un peu moins de francs CFA par dollar que le taux réel. Cette marge n'apparaît nulle part sur la facture.</p>
<h2>Un exemple avec les tarifs relevés et le taux du ${echapper(d.taux.date)}</h2>
<p>Pour 200 ${t.o.devise} envoyés ${echapper(t.o.de)} ${echapper(t.dest.au)}, au taux de référence de la Banque centrale européenne (1 ${t.o.devise} = ${formater(t.tauxRef, 2)} ${t.dest.devise}), la famille devrait recevoir ${formater(reference)} ${t.dest.devise} si personne ne prenait rien.</p>
${tableau(res, t.o.devise, t.dest.devise)}
${
  sansFraisChers && sansFraisChers.coutPourcent > 0.5
    ? `<p>${echapper(sansFraisChers.fournisseur.nom)} n'affiche aucun frais, mais sa marge sur le taux coûte quand même ${formater(sansFraisChers.coutPourcent, 1)} % du montant, soit ${formater(reference - sansFraisChers.montantRecu)} ${t.dest.devise} de moins pour la famille.</p>`
    : ""
}
<h2>La règle simple</h2>
<ol><li>Ignorez le mot « gratuit ».</li><li>Regardez combien la famille reçoit, en francs CFA, pour le même montant envoyé.</li><li>Comparez ce montant entre plusieurs services : c'est ce que fait notre ${lienTrajet(t.o, t.dest)}.</li></ol>
<p class="doux">Taux standard relevé chez chaque service, hors offres de bienvenue. Vérifiez toujours le montant final avant d'envoyer.</p>`;
  },
};

const mobileMoney: Guide = {
  titre: "Envoyer de l'argent sur Wave, Orange Money ou MTN MoMo depuis le Canada",
  resume: "Quels services livrent sur un portefeuille mobile, et lequel donne le plus aujourd'hui.",
  chemin: "guides/mobile-money-depuis-le-canada/",
  html: (d) => {
    const blocs = d.corridors.destinations
      .map((dest) => {
        const t = trajet(d, "CA", dest.code);
        if (!t) return "";
        const res = classer(200, t.o.devise, dest.code, "mobile", t.tauxRef, d.fournisseurs, d.aujourdHui);
        if (!res.length) return "";
        const m = res[0];
        return `<h2>${echapper(dest.nom)}</h2>
<p>Portefeuilles courants : ${dest.portefeuilles.map(echapper).join(", ")}. Services relevés qui livrent sur un portefeuille mobile : ${res.map((r) => echapper(r.fournisseur.nom)).join(", ")}.</p>
<p>Pour 200 ${t.o.devise}, le meilleur aujourd'hui est <strong>${echapper(m.fournisseur.nom)}</strong> : ${formater(m.montantRecu)} ${dest.devise} reçus (coût total ${formater(m.coutPourcent, 1)} %). Voir le ${lienTrajet(t.o, dest)}.</p>`;
      })
      .join("");
    return `<h1>Envoyer sur Wave, Orange Money ou MTN MoMo depuis le Canada</h1>
<p>Au Sénégal, en Côte d'Ivoire et au Cameroun, beaucoup de familles reçoivent l'argent directement sur leur téléphone. C'est souvent le moyen le plus rapide : quelques minutes, sans se déplacer.</p>
${blocs}
<h2>Avant d'envoyer</h2>
<ul><li>Vérifiez le nom exact du titulaire du portefeuille et son numéro avec l'indicatif du pays.</li>
<li>Vérifiez dans l'application du service que le portefeuille de votre proche est bien proposé pour ce pays : la liste change parfois.</li>
<li>Comparez le montant reçu, pas seulement les frais : <a href="${BASE}guides/sans-frais-pas-gratuit/">voir pourquoi</a>.</li></ul>
<p class="doux">Tarifs relevés chez chaque service ; montants calculés avec le taux de la Banque centrale européenne du ${echapper(d.taux.date)}.</p>`;
  },
};

const francCfa: Guide = {
  titre: "Franc CFA et euro : pourquoi les envois depuis la France coûtent moins cher",
  resume: "Le taux fixe du franc CFA expliqué, et ce que ça change pour vos envois.",
  chemin: "guides/franc-cfa-et-euro/",
  html: (d) => {
    const ca = trajet(d, "CA", "SN");
    const fr = trajet(d, "FR", "SN");
    if (!ca || !fr) return "";
    const moyenne = (t: NonNullable<typeof ca>) => {
      const res = classer(200, t.o.devise, t.dest.code, null, t.tauxRef, d.fournisseurs, d.aujourdHui);
      return res.length ? res.reduce((s, r) => s + r.coutPourcent, 0) / res.length : 0;
    };
    return `<h1>Franc CFA et euro : un taux fixe</h1>
<p>Le franc CFA d'Afrique de l'Ouest (XOF) et celui d'Afrique centrale (XAF) ont un taux fixe avec l'euro : <strong>1 € = 655,957 FCFA</strong>, tous les jours. Il ne bouge pas.</p>
<h2>Depuis la France</h2>
<p>Comme le taux est fixe, la plupart des services appliquent exactement 655,957 : ils ne peuvent pas cacher de marge sur le taux sans que ça se voie. Ils gagnent surtout leur argent sur les frais. Aujourd'hui, le coût moyen relevé ${echapper(fr.o.de)} ${echapper(fr.dest.au)} est de ${formater(moyenne(fr), 1)} % pour 200 €.</p>
<h2>Depuis le Canada</h2>
<p>Le dollar canadien n'est pas lié à l'euro : son taux en francs CFA change chaque jour (aujourd'hui, 1 $ CA = ${formater(ca.tauxRef, 2)} FCFA selon la Banque centrale européenne). Les services peuvent donc garder une marge sur ce taux, en plus des frais. Le coût moyen relevé ${echapper(ca.o.de)} ${echapper(ca.dest.au)} est de ${formater(moyenne(ca), 1)} % pour 200 $ CA.</p>
<h2>Ce que ça veut dire pour vous</h2>
<ul><li>Depuis la France : comparez surtout les frais.</li><li>Depuis le Canada : comparez le montant reçu, car la marge sur le taux pèse souvent autant que les frais, voire plus.</li></ul>
<p>Comparatifs : ${lienTrajet(fr.o, fr.dest)}, ${lienTrajet(ca.o, ca.dest)}.</p>`;
  },
};

export const GUIDES: Guide[] = [sansFrais, mobileMoney, francCfa];

export function pagesGuides(d: Donnees): { chemin: string; html: string }[] {
  return GUIDES.map((g) => ({ chemin: g.chemin, html: page(`${g.titre} · ${d.nomSite}`, g.resume, d.nomSite, g.html(d), g.chemin) }));
}
