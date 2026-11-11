# Comparateur de transferts d'argent (prototype)

En ligne : https://louikagirard-creator.github.io/comparateur-transferts/ (mis à jour automatiquement chaque jour de semaine à 16 h 30 UTC).

Site automatique qui compare ce que reçoit vraiment une famille en Afrique francophone quand on lui envoie de l'argent du Canada ou de France : frais, taux de change et marge cachée. Aucune IA en direct et aucune clé API : un script met à jour les taux et reconstruit le site chaque jour.

> **Tarifs relevés à la main le 10 novembre 2026** sur les calculateurs publics de Taptap Send et Sendwave (14 trajets), de Remitly (12 trajets : pas Canada → Mali ni Canada → Burkina Faso, où seul le tarif de bienvenue s'affichait) et de WorldRemit (3 trajets depuis le Canada), pour 200 $ CA ou 200 €, taux standard hors offres de bienvenue. Western Union et MoneyGram ne sont pas encore relevés. Une bannière l'indique sur chaque page tant que `data/fournisseurs.json` contient son champ `_bandeau`.

## Essayer

Il faut Node.js 22.18 ou plus récent.

```bash
cd international/comparateur-transferts
```

```bash
npm run mise-a-jour
```

```bash
npm run apercu
```

Puis ouvrir http://localhost:4000. 14 trajets : Canada et France vers le Sénégal, la Côte d'Ivoire, le Cameroun, le Mali, le Burkina Faso, le Togo et le Bénin.

## Comment ça marche

1. `npm run mise-a-jour` télécharge le taux de référence du jour de la Banque centrale européenne (API gratuite Frankfurter, sans clé). Le franc CFA a une parité fixe : 1 € = 655,957 FCFA.
2. Pour chaque fournisseur : montant reçu = (montant − frais) × taux de référence × (1 − marge de change). Le classement se fait toujours par montant reçu, jamais par commission.
3. Le script génère le site dans `dist/` : une page d'accueil, une page par corridor avec un calculateur, une page « Notre méthode », et `alerte-du-jour.txt` (texte prêt à publier sur une chaîne Telegram ou WhatsApp).
4. Si l'API des taux ne répond pas, le site est reconstruit avec les derniers taux enregistrés dans `data/taux.json`.

## Avant la mise en ligne

1. **Compléter et refaire les relevés chaque semaine** dans [data/fournisseurs.json](data/fournisseurs.json) : ajouter Western Union, MoneyGram, Lemfi et WorldRemit depuis la France. Pour chaque trajet, simuler un envoi de 200 sur le site du fournisseur et noter les frais et le taux standard ; la marge se calcule par rapport au taux de la BCE du jour. Un tarif peut être propre à un trajet (clé `"CAD-SN"`) ou commun à une devise (clé `"CAD"`) ; une remarque propre à un trajet va dans `notes`. Ne pas réutiliser les données de comparaison de Wise sans son accord écrit (ses conditions l'interdisent). À terme, utiliser les flux des partenaires d'affiliation. Retirer le champ `_bandeau` quand les relevés sont complets.
2. **Mettre vos liens d'affiliation** dans le champ `lien` (`affilie: true` pour les liens rémunérés : ils sont marqués comme tels sur le site).
3. **Choisir un nom** (variable `NOM_SITE`) et un nom de domaine.
4. **Publication automatique (en place)** : GitHub Pages, source GitHub Actions. Le fichier [.github/workflows/mise-a-jour.yml](.github/workflows/mise-a-jour.yml) lance la mise à jour chaque jour de semaine à 16 h 30 UTC, après la publication des taux de la BCE ; on peut aussi la lancer à la main avec `gh workflow run mise-a-jour.yml`.
5. **Google Search Console** : déposer le fichier de vérification `googleXXXX.html` dans `public/`, publier, valider, puis soumettre `sitemap.xml`.

Ajouter un corridor : une ligne dans `origines` ou `destinations` de [data/corridors.json](data/corridors.json). Les devises hors franc CFA doivent être publiées par la BCE (le dirham marocain et la gourde haïtienne ne le sont pas : il faudra une autre source de taux).

## Pour les développeurs

```bash
npm test
```

```bash
npm run typecheck
```

Les tests vérifient notamment que le calculateur du navigateur donne exactement les mêmes résultats que le générateur du site.

| Fichier | Rôle |
| --- | --- |
| [src/calcul.ts](src/calcul.ts) | Taux de référence, montant reçu, coût total, classement |
| [src/taux.ts](src/taux.ts) | Téléchargement et cache des taux de la BCE |
| [src/site.ts](src/site.ts) | Pages HTML et calculateur du navigateur |
| [src/guides.ts](src/guides.ts) | Guides dont les chiffres viennent des relevés du jour |
| [src/mettre-a-jour.ts](src/mettre-a-jour.ts) | Mise à jour quotidienne complète |
| [src/apercu.ts](src/apercu.ts) | Serveur local pour voir le site |
