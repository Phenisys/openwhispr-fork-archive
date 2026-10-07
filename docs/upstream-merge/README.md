# Fusion amont — mode opératoire

Objectif du fork : **rester au plus proche de la version officielle d'OpenWhispr**
(nouveautés et correctifs), en excluant la couche **compte / login / cloud /
workspace / billing / sync / MS-Calendar / enterprise** (politique BYOK / local /
self-hosted).

## En une commande

```bash
scripts/upstream-merge.sh v1.10.0          # fusion + résolution mécanique
scripts/upstream-merge.sh v1.10.0 --check  # simulation, aucune mutation
scripts/upstream-merge.sh v1.10.0 --verify # + npm ci / tests / lint / typecheck / build
```

Le script récupère le tag officiel **sans ajouter de remote permanent**, fait un
`git merge --no-ff`, applique le manifeste d'exclusion, puis affiche ce qui reste
à arbitrer.

## Ce qui est mécanique, ce qui est humain

| Étape | Nature | Outil |
|---|---|---|
| Chemins que le fork a purgés (`[purged]`) | mécanique | `scripts/upstream_merge_resolve.py` |
| Fichiers exclus arrivant **sans conflit** (`[excluded]`) | mécanique | `scripts/upstream_merge_resolve.py` |
| Fichiers ressemblant à la couche exclue (`[warn]`) | alerte seulement | rapport du résolveur |
| Conflits de contenu | **humain** | `docs/upstream-merge/arbitrage-<tag>.md` |

Le manifeste `exclusions.txt` est la **forme mécanique de la divergence** : c'est
lui qui évite de rejouer la purge à la main à chaque version. Toute entrée ajoutée
est une décision d'exclusion — à relire et à versionner comme du code.

## Règle de parité fonctionnelle — l'amont d'abord, nos spécificités ensuite

Ordre imposé, à chaque fusion :

1. **Fusionner l'amont entier** (nouveautés, correctifs, tests).
2. **Ré-appliquer nos spécificités** sur le résultat : BYOK / local /
   self-hosted ; on retire la couche compte / cloud / workspace / billing /
   sync / MS-Calendar / enterprise.
3. **Passer la porte de parité** :
   `node scripts/upstream-parity-audit.mjs --tag vX.Y.Z --fetch`.

Deux interdits, parce que les deux pertes constatées viennent de là :

- **Résoudre un conflit « en gardant le nôtre ».** Un fichier commun absorbé
  d'un bloc perd en silence tout ce que l'amont y avait ajouté. Chaque hunk
  amont doit être soit porté, soit écarté avec une raison écrite.
- **Exclure un fichier sans lire ce qu'il porte.** La couche cloud contient des
  fonctionnalités qui n'ont rien de cloud : `src/components/notes/SpacesTree.tsx`
  (exclu) portait le **menu d'actions des notes** — supprimer, renommer — donc
  notre arbre local n'a ni bouton de suppression ni renommage de dossier.
  La fonctionnalité (et son test) doit être **portée dans notre équivalent
  local avant** d'inscrire le chemin dans `exclusions.txt`.

### L'audit de parité

```bash
node scripts/upstream-parity-audit.mjs --tag v1.10.2 --fetch          # + rapport
node scripts/upstream-parity-audit.mjs --upstream refs/tmp/upstream-v1.10.2
```

Déterministe, aucun LLM, aucune mutation : il lit deux arbres et écrit
`docs/upstream-merge/parity-<tag>.md`. Code de sortie **1** = arbitrage requis.

| Contrôle | Ce qu'il attrape | Traitement |
|---|---|---|
| 1. Fichiers amont absents | Un fichier officiel ni purgé ni exclu = oubli probable | le porter, ou l'ajouter au manifeste avec une raison |
| 2. Lignes amont absentes dans les fichiers communs | Ce que l'amont a ajouté dans un fichier que nous avons réécrit | relire la section 2 du rapport, fichier par fichier |
| 3. Clés d'interface orphelines | Un écran ou une action disparus (la clé n'est plus référencée) | hors couche exclue = à vérifier |
| 4. Contrat `parity-checks.txt` | Les fonctionnalités nommées qui doivent survivre | `MANQUANT` → porter, ou `waived=<raison>` |

Le contrat `docs/upstream-merge/parity-checks.txt` est la mémoire des pertes
déjà payées : une aiguille littérale par fonctionnalité, vérifiée des deux
côtés (`PÉRIMÉ` si l'amont ne contient plus l'aiguille — donc le contrat ne
protège plus rien). Toute exclusion d'un fichier porteur de fonctionnalité doit
y ajouter sa ligne.

**Ce que l'audit ne voit pas** : une fonctionnalité dont l'aiguille est un
identifiant local, et tout ce qui a été perdu *à l'intérieur* d'un fichier
exclu. La section 2 et la relecture du manifeste restent humaines.

## Après l'arbitrage

```bash
git add -A && git commit                       # finalise le merge
scripts/upstream-merge.sh <tag> --verify       # sélectionne un Node 24 sain puis vérifie
# ou, à la main (avec un Node 24 RÉCENT sur le PATH) :
npm ci && npm test && npm run lint && npm run typecheck && npm run build:renderer
```

**Node 24 obligatoire — et RÉCENT** (`.nvmrc`). Deux pièges distincts :

1. **Majeur ≠ 24** : `npm ci` casse le lockfile et l'ABI de `better-sqlite3`
   (faux échecs de tests).
2. **Node 24 ANCIEN** (ex. **24.1.0**, version par défaut de certains `nvm`) :
   le **runner de tests** casse. Avec `--import tsx`, les exports nommés des
   modules `.ts` importés dynamiquement se résolvent mal → des **milliers de faux
   échecs** (`TypeError: X is not a function`). Symptôme typique : `npm test` rouge
   en masse **alors que** lint / typecheck / build passent. Remède : un Node 24
   récent (`fnm install 24 && fnm use 24`, ou `nvm install 24.21`) — **vérifié bon
   en 24.21.0**, qui est aussi ce que la CI `setup-node "24"` résout.

`scripts/upstream-merge.sh --verify` sélectionne désormais lui-même le Node 24 le
plus récent installé (nvm **et** fnm) et le **valide par une sonde tsx** : si aucun
n'est sain, il s'arrête avec un message explicite (code 70) plutôt que de rapporter
de faux échecs. Il ne retombe jamais sur un autre majeur.

## Historique des décisions

- **2026-10-07 — parité fonctionnelle rendue mécanique.** Audit
  `scripts/upstream-parity-audit.mjs` + contrat `parity-checks.txt` écrits après
  deux pertes constatées en v1.10.2 : le **bouton de suppression de note** et le
  **renommage de dossier**, tous deux portés par le `SpacesTree.tsx` exclu, et
  le **menu « Nouvelle note / Nouveau chat »** du panneau, remplacé par un
  bouton simple. Règle adoptée : l'amont d'abord, nos spécificités ensuite.
  L'audit de v1.10.2 (audit de référence) signalait alors 40 fichiers amont non
  classés → 38 classés dans le manifeste, 2 laissés à trancher, plus les
  fonctionnalités manquantes. La **fin d'enregistrement automatique** a été
  vérifiée à cette occasion : contrôleur, événement IPC, éligibilité et offre de
  résumé sont **à parité** (0 ligne d'écart sur les fichiers concernés) — sa
  perte éventuelle n'est pas un écart de code.
- **2026-09-11 — stratégie « fusion amont » retenue**, portage commit-par-commit
  abandonné. Mesures : fusion directe de `v1.10.0` dans `main` = **103** conflits
  (37 contenu / 66 modify-delete) ; après merge de la branche de portage v1.9.0 =
  **215** (dont 42 `add/add`) ; avec ancrage `-s ours` = **306**. La branche de
  portage est conservée comme référence sous le tag `port/v1.9.0-reference`.
- La table de politique d'arbitrage (`inventory.md` / `decisions-to-port.md`) est
  récupérable depuis ce tag : `git checkout port/v1.9.0-reference -- docs/upstream-1.9.0/`.
