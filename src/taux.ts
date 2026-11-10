import fs from "node:fs";

// Taux de référence de la Banque centrale européenne, via l'API gratuite Frankfurter (sans clé).
// La BCE publie un taux par jour ouvrable vers 16 h (heure d'Europe centrale).
const URL_BCE = "https://api.frankfurter.dev/v1/latest?base=EUR";
export const FICHIER_TAUX = "data/taux.json";

export type TauxBce = { date: string; rates: Record<string, number>; source: string };

export async function telechargerTaux(devises: string[]): Promise<TauxBce> {
  const r = await fetch(`${URL_BCE}&symbols=${devises.join(",")}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Taux BCE indisponibles (HTTP ${r.status})`);
  const d = (await r.json()) as { date?: string; rates?: Record<string, number> };
  if (!d.date || !d.rates) throw new Error("Réponse inattendue de l'API des taux");
  for (const devise of devises) {
    if (!(d.rates[devise] > 0)) throw new Error(`Taux manquant pour ${devise}`);
  }
  return { date: d.date, rates: d.rates, source: "Banque centrale européenne (via frankfurter.dev)" };
}

export function lireTauxEnCache(): TauxBce | null {
  if (!fs.existsSync(FICHIER_TAUX)) return null;
  return JSON.parse(fs.readFileSync(FICHIER_TAUX, "utf8")) as TauxBce;
}

export function enregistrerTaux(t: TauxBce): void {
  fs.writeFileSync(FICHIER_TAUX, JSON.stringify(t, null, 2) + "\n");
}
