#!/usr/bin/env bash
# Fusion d'une release officielle OpenWhispr dans le fork Phenisys.
#
# Objectif du fork : rester AU PLUS PRÈS de la version officielle (nouveautés et
# correctifs), en excluant la couche compte/login/cloud/workspace/billing/sync/
# MS-Calendar/enterprise (politique BYOK / local / self-hosted).
#
# Ce que le script fait :
#   1. vérifie l'arbre propre, récupère le tag officiel (sans remote permanent) ;
#   2. `git merge --no-ff` du tag ;
#   3. applique le manifeste d'exclusion (scripts/upstream_merge_resolve.py) :
#      chemins purgés maintenus supprimés + fichiers exclus arrivés sans conflit,
#      puis assertions et rapport des références orphelines ;
#   4. laisse les conflits de contenu à l'arbitrage humain (règle : l'amont
#      gagne, sauf spécificité Phenisys assumée) et affiche la marche à suivre ;
#   5. passe la porte de PARITÉ FONCTIONNELLE (scripts/upstream-parity-audit.mjs) :
#      toute fonctionnalité officielle encore absente est listée, et le script
#      sort en code 1 tant qu'elle n'est pas portée ou explicitement écartée
#      (`waived=` dans docs/upstream-merge/parity-checks.txt).
#
# Usage :
#   scripts/upstream-merge.sh v1.10.0
#   scripts/upstream-merge.sh v1.10.0 --check      # simulation, aucune mutation
#   scripts/upstream-merge.sh v1.10.0 --verify     # + npm ci && tests && lint ...
#   scripts/upstream-merge.sh v1.10.0 --upstream-url https://github.com/ORG/REPO.git
set -euo pipefail

UPSTREAM_URL_DEFAULT="https://github.com/OpenWhispr/openwhispr.git"
TAG=""
UPSTREAM_URL="$UPSTREAM_URL_DEFAULT"
CHECK=0
VERIFY=0
MANIFEST="docs/upstream-merge/exclusions.txt"

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    --verify) VERIFY=1 ;;
    --upstream-url) UPSTREAM_URL="${2:?--upstream-url attend une URL}"; shift ;;
    --manifest) MANIFEST="${2:?--manifest attend un chemin}"; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    -*) echo "option inconnue : $1" >&2; exit 64 ;;
    *) TAG="$1" ;;
  esac
  shift
done

[ -n "$TAG" ] || { echo "usage : scripts/upstream-merge.sh <tag> [--check] [--verify] [--upstream-url URL]" >&2; exit 64; }

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
LOCAL_REF="upstream-${TAG}"

echo "=== Fusion amont $TAG dans le fork Phenisys ==="
echo "  dépôt        : $REPO"
echo "  branche      : $(git branch --show-current)"
echo "  référence    : $LOCAL_REF"
echo "  manifeste    : $MANIFEST"

[ -f "$MANIFEST" ] || { echo "ERREUR : manifeste introuvable ($MANIFEST)" >&2; exit 66; }

if [ -n "$(git status --porcelain)" ]; then
  echo "ERREUR : arbre de travail non propre — commitez ou remisez avant de fusionner." >&2
  git status --short | head -20 >&2
  exit 65
fi

# --- Résolution du Node ---------------------------------------------------
# Le runner de tests (`node --import tsx --test`) est SENSIBLE à la version de
# Node : sur les Node 24 anciens (ex. 24.1.0), tsx résout mal les exports nommés
# des modules .ts importés dynamiquement → des MILLIERS de faux échecs
# (`TypeError: X is not a function`). On choisit donc, parmi les Node du majeur
# demandé par .nvmrc, le plus RÉCENT installé (nvm et fnm), et on le VALIDE par
# une sonde tsx : un `--verify` rouge doit être un VRAI échec, jamais un artefact
# de version. Un Node d'un autre majeur est refusé (ABI better-sqlite3 / lockfile).
WANT_NODE="$(tr -d 'v \n' < .nvmrc 2>/dev/null || echo 24)"
WANT_MAJOR="${WANT_NODE%%.*}"
NODE_BIN=""
NODE_OK=0

node_major() { # $1 = répertoire bin
  "$1/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo "?"
}

node_candidates() {
  local active
  active="$(command -v node 2>/dev/null || true)"
  [ -n "$active" ] && dirname "$active"
  { ls -d "${NVM_DIR:-$HOME/.nvm}/versions/node/v${WANT_MAJOR}"*/bin 2>/dev/null
    ls -d "${FNM_DIR:-$HOME/.local/share/fnm}/node-versions/v${WANT_MAJOR}"*/installation/bin 2>/dev/null
  } | sort -V -r
}

node_tsx_ok() { # $1 = répertoire bin
  [ -x "$1/node" ] || return 1
  [ "$(node_major "$1")" = "$WANT_MAJOR" ] || return 1
  local probe_dir
  probe_dir="$(mktemp -d)"
  printf 'export const PROBE = 1;\n' > "$probe_dir/probe.ts"
  PATH="$1:$PATH" node --import tsx \
    -e "import('file://$probe_dir/probe.ts').then((m) => process.exit(m.PROBE === 1 ? 0 : 1)).catch(() => process.exit(1))" \
    >/dev/null 2>&1
  local rc=$?
  rm -rf "$probe_dir"
  return "$rc"
}

while IFS= read -r candidate; do
  if node_tsx_ok "$candidate"; then
    NODE_BIN="$candidate"
    NODE_OK=1
    break
  fi
done < <(node_candidates)

run_with_node() {
  if [ -n "${NODE_BIN:-}" ]; then
    PATH="$NODE_BIN:$PATH" "$@"
  else
    "$@"
  fi
}

if ! git rev-parse -q --verify "refs/tags/$LOCAL_REF" >/dev/null; then
  echo "-- récupération du tag officiel (sans ajouter de remote permanent) --"
  git fetch --no-tags "$UPSTREAM_URL" "refs/tags/${TAG}:refs/tags/${LOCAL_REF}"
fi
echo "  commit amont : $(git rev-parse --short "refs/tags/$LOCAL_REF")"
echo "  merge-base   : $(git merge-base HEAD "refs/tags/$LOCAL_REF" | cut -c1-12)"

if [ "$CHECK" = "1" ]; then
  echo
  echo "-- simulation : la fusion ne sera pas effectuée --"
  python3 scripts/upstream_merge_resolve.py --manifest "$MANIFEST" --check || rc=$?
  exit "${rc:-0}"
fi

echo
echo "-- fusion (un code de sortie 1 signifie « conflits », pas « échec ») --"
set +e
git merge --no-ff --no-edit "refs/tags/$LOCAL_REF"
MERGE_RC=$?
set -e

if [ "$MERGE_RC" -eq 0 ]; then
  echo "-- fusion sans conflit : le manifeste est quand même appliqué --"
elif [ "$MERGE_RC" -eq 1 ]; then
  echo "-- conflits détectés : résolution mécanique puis arbitrage humain --"
else
  echo "ERREUR : git merge a échoué (code $MERGE_RC)" >&2
  exit "$MERGE_RC"
fi

set +e
python3 scripts/upstream_merge_resolve.py --manifest "$MANIFEST"
RESOLVE_RC=$?
set -e

echo
case "$RESOLVE_RC" in
  0) echo "Résolution mécanique OK, aucun conflit de contenu : la fusion peut être committée." ;;
  2) echo "Conflits de contenu restants : arbitrer fichier par fichier (l'amont gagne," \
          "sauf spécificité Phenisys — cf. docs/upstream-1.9.0/inventory.md de la branche" \
          "de portage, tag port/v1.9.0-reference)." ;;
  1) echo "ERREUR : chemins interdits encore présents, ou importations pointant vers" \
          "une cible absente (nettoyage du câblage à faire avant de committer)." >&2 ;;
  *) echo "ERREUR : résolution mécanique incomplète (code $RESOLVE_RC)." >&2 ;;
esac

echo
echo "-- parité fonctionnelle (l'amont d'abord, nos spécificités ensuite) --"
set +e
node scripts/upstream-parity-audit.mjs --tag "$TAG" --upstream "refs/tags/$LOCAL_REF"
PARITY_RC=$?
set -e
if [ "$PARITY_RC" = "0" ]; then
  echo "Parité fonctionnelle vérifiée."
else
  echo "Parité fonctionnelle INCOMPLÈTE : la fusion n'est pas terminée tant que les points" \
       "ci-dessus ne sont pas portés ou tranchés (waived= dans docs/upstream-merge/parity-checks.txt)."
fi

if [ "$VERIFY" = "1" ]; then
  echo
  echo "-- vérifications (Node ${WANT_NODE} ; choisi : ${NODE_BIN:-PATH}) --"
  if [ "$NODE_OK" != "1" ]; then
    echo "ERREUR : aucun Node ${WANT_MAJOR} utilisable — la sonde tsx échoue sur tous les candidats." >&2
    echo "  Le runner de tests casse sur les Node ${WANT_MAJOR} anciens (ex. 24.1.0) : tsx y résout mal" >&2
    echo "  les exports nommés des modules .ts importés dynamiquement (milliers de faux échecs)." >&2
    echo "  Installez un Node ${WANT_MAJOR} récent (\`fnm install 24 && fnm use 24\`, ou \`nvm install 24.21\`)," >&2
    echo "  puis relancez :" >&2
    echo "    npm ci && npm test && npm run lint && npm run typecheck && npm run build:renderer" >&2
    exit 70
  fi
  run_with_node npm ci
  run_with_node npm test
  run_with_node npm run lint
  run_with_node npm run typecheck
  run_with_node npm run build:renderer
fi

if [ "$RESOLVE_RC" != "0" ]; then
  exit "$RESOLVE_RC"
fi
exit "$PARITY_RC"