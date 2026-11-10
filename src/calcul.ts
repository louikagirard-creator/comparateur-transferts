// Calculs du comparateur. Aucune IA : de l'arithmétique sur des tarifs relevés.

export type Tarif = { frais_fixes: number; frais_pourcent: number; marge_change_pourcent: number };

export type Fournisseur = {
  id: string;
  nom: string;
  lien: string;
  affilie: boolean;
  releve_le: string; // AAAA-MM-JJ
  tarifs: Record<string, Tarif>; // par trajet ("CAD-SN") ou, à défaut, par devise d'envoi ("CAD")
  note?: string; // précision affichée sous le nom (ex. frais différents selon le montant)
  notes?: Record<string, string>; // précisions propres à un trajet ("CAD-CI"), prioritaires sur note
  modes: string[];
  destinations: string[];
  delai: string;
};

export type Resultat = {
  fournisseur: Fournisseur;
  frais: number; // dans la devise d'envoi
  tauxApplique: number; // unités de devise reçue pour 1 unité envoyée
  montantRecu: number; // arrondi à l'unité (le franc CFA n'a pas de centimes)
  coutTotal: number; // coût total en devise d'envoi : frais + marge cachée
  coutPourcent: number;
  perime: boolean;
};

export const JOURS_AVANT_PEREMPTION = 7;

/** Taux de référence devise d'envoi → devise reçue, à partir des taux de la BCE (base EUR) et des parités fixes. */
export function tauxReference(
  devEnvoi: string,
  devRecue: string,
  tauxBceDepuisEuro: Record<string, number>,
  paritesFixes: Record<string, { euro: number }>,
): number {
  const euroVers = (devise: string): number => {
    if (devise === "EUR") return 1;
    if (paritesFixes[devise]) return paritesFixes[devise].euro;
    const t = tauxBceDepuisEuro[devise];
    if (!t) throw new Error(`Taux inconnu pour ${devise}`);
    return t;
  };
  return euroVers(devRecue) / euroVers(devEnvoi);
}

function joursEntre(a: string, b: Date): number {
  return Math.floor((b.getTime() - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Tarif d'un fournisseur pour un trajet : d'abord le tarif propre au trajet, sinon celui de la devise. */
export function tarifPour(f: Fournisseur, devEnvoi: string, destination: string): Tarif | undefined {
  return f.tarifs[`${devEnvoi}-${destination}`] ?? f.tarifs[devEnvoi];
}

export function calculer(
  montant: number,
  devEnvoi: string,
  destination: string,
  tauxRef: number,
  fournisseur: Fournisseur,
  aujourdHui: Date,
): Resultat | null {
  const t = tarifPour(fournisseur, devEnvoi, destination);
  if (!t || !(montant > 0)) return null;
  const frais = Math.round((t.frais_fixes + (montant * t.frais_pourcent) / 100) * 100) / 100;
  if (frais >= montant) return null;
  const tauxApplique = tauxRef * (1 - t.marge_change_pourcent / 100);
  const montantRecu = Math.floor((montant - frais) * tauxApplique);
  // Coût total = ce qu'il aurait fallu en plus pour recevoir la même somme au taux de référence sans frais.
  const coutTotal = Math.round((montant - montantRecu / tauxRef) * 100) / 100;
  return {
    fournisseur,
    frais,
    tauxApplique,
    montantRecu,
    coutTotal,
    coutPourcent: Math.round((coutTotal / montant) * 1000) / 10,
    perime: joursEntre(fournisseur.releve_le, aujourdHui) > JOURS_AVANT_PEREMPTION,
  };
}

/** Classement honnête : par montant reçu décroissant, quelle que soit la commission. */
export function classer(
  montant: number,
  devEnvoi: string,
  destination: string,
  mode: string | null,
  tauxRef: number,
  fournisseurs: Fournisseur[],
  aujourdHui: Date,
): Resultat[] {
  return fournisseurs
    .filter((f) => f.destinations.includes(destination) && (mode === null || f.modes.includes(mode)))
    .map((f) => calculer(montant, devEnvoi, destination, tauxRef, f, aujourdHui))
    .filter((r): r is Resultat => r !== null)
    .sort((a, b) => b.montantRecu - a.montantRecu || a.fournisseur.nom.localeCompare(b.fournisseur.nom));
}

export function formater(n: number, decimales = 0): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).replace(/ | /g, " ");
}
