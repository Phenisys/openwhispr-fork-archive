#!/usr/bin/env python3
"""Résolution mécanique d'une fusion amont dans le fork Phenisys.

À lancer APRÈS `git merge <tag-upstream>` : applique le manifeste
`docs/upstream-merge/exclusions.txt` (voir son en-tête pour le rôle des
sections), vérifie qu'aucun chemin exclu ne subsiste et signale les références
orphelines laissées par les fichiers supprimés.

Ne touche jamais aux conflits de contenu : ceux-là sont des arbitrages humains
(règle : l'amont gagne, sauf spécificité Phenisys assumée).

Porte EXCLU-MODIFIÉ : un fichier EXCLU que la release amont a MODIFIÉ depuis la
dernière release fusionnée n'est PAS supprimé à l'aveugle — il est conservé et
la résolution échoue (code 1) tant qu'il n'a pas été porté puis tracé dans la
section `[excluded-reviewed]` du manifeste (`<chemin>  # <tag> <date> <décision>`).
Les chemins PURGÉS restent supprimés sans blocage.

Usage :
  scripts/upstream_merge_resolve.py            # applique le manifeste
  scripts/upstream_merge_resolve.py --check    # rapport seul, aucune mutation

Codes de sortie : 0 = résolution mécanique OK ; 1 = violation d'assertion (un
chemin interdit non tracé subsiste, une importation relative pointe vers une
cible absente, ou un exclu-modifié n'est ni porté ni tracé) ; 2 = des conflits
de contenu subsistent (normal, à arbitrer à la main).
"""
from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
import sys
from pathlib import Path

CODE_EXT = (".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx")
RESOLVE_EXT = (".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json")
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".worktrees", "out"}

# `require("…")`, `import … from "…"`, `import("…")`, `import "…"`.
SPEC_RE = re.compile(r"""(?:require\s*\(\s*|from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]""")
# Les littéraux gabarits sont retirés avant le scan : les générateurs de code
# (scripts/sync-nucleo-icons.js) contiennent des `from "./createIcon"` qui ne
# sont pas des importations de ce fichier.
TEMPLATE_RE = re.compile(r"`(?:[^`\\]|\\.)*`", re.S)


def blank_templates(text):
    """Neutralise les littéraux gabarits en conservant le numérotage des lignes."""
    return TEMPLATE_RE.sub(lambda m: "``" + "\n" * m.group(0).count("\n"), text)


def run(args, cwd=None):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    return p.stdout, p.stderr, p.returncode


def git(repo, *args, ok=True):
    out, err, rc = run(["git", "-C", repo, *args])
    if ok and rc != 0:
        sys.exit("FAILED: git %s\n%s" % (" ".join(args), err.strip()))
    return out


def parse_manifest(path):
    """Retourne (purged, excluded, warn, excluded_reviewed) — listes et motifs.

    `excluded_reviewed` : chemins de la section `[excluded-reviewed]`,
    format `<chemin>  # <tag-amont> <date> <décision>`. On ne garde que le
    chemin ; le commentaire est la traçabilité demandée par la politique du
    fork (on a LUS le diff amont avant de confirmer l'exclusion).
    """
    purged, excluded, warn, excluded_reviewed = [], [], [], []
    section = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^\[([\w-]+)\]", line)
        if m:
            section = m.group(1)
            continue
        if section == "purged":
            purged.append(line)
        elif section == "excluded":
            excluded.append(line)
        elif section == "warn":
            warn.append(line)
        elif section == "excluded-reviewed":
            excluded_reviewed.append(line.split("#", 1)[0].strip().rstrip("+"))
    return purged, excluded, warn, excluded_reviewed


def code_files(repo):
    """Fichiers de code de l'arbre, hors dépendances et artefacts de build."""
    root = Path(repo)
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in CODE_EXT:
            continue
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        yield rel, path


def resolves(base, spec):
    """Résout un specifier relatif comme le fait le bundleur.

    `git grep`/le nom de fichier ne suffisent pas : une même cible s'écrit
    `./x`, `./x.js` (le TS autorise l'extension `.js` pour un fichier `.ts`),
    `x/index`, `x.ts`… Toute variante non résolue est une importation cassée.
    """
    cands = [spec]
    # extension explicite qui ne correspond pas au fichier réel (TS/ESM)
    if spec.endswith((".js", ".mjs", ".cjs", ".jsx")):
        stem = spec.rsplit(".", 1)[0]
        cands += [stem + ".ts", stem + ".tsx", stem + ".js", stem + ".jsx"]
    for ext in RESOLVE_EXT:
        cands.append(spec + ext)
        cands.append(spec.rstrip("/") + "/index" + ext)
    return any((base / c).is_file() for c in cands)


def scan_dangling_specifiers(repo):
    """Importations relatives dont la cible n'existe pas sur le disque.

    C'est l'assertion qui compte après une fusion : `typecheck` ne voit que le
    projet TS de `src`, `lint` est statique et le build du renderer ne charge
    jamais le processus principal, qui s'exécute non groupé depuis `main.js`.
    Un `require("./<module purgé>")` y survivait donc à toutes les gardes vertes
    et tuait le démarrage de l'application.
    """
    dangling = {}
    for rel, path in code_files(repo):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if "`" in text:
            text = blank_templates(text)
        for match in SPEC_RE.finditer(text):
            spec = match.group(1)
            if not (spec.startswith("./") or spec.startswith("../")):
                continue
            if resolves(path.parent, spec):
                continue
            line = text[: match.start()].count("\n") + 1
            dangling.setdefault(str(rel), []).append((line, spec))
    return dangling


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=None, help="racine du dépôt (défaut : git top-level)")
    ap.add_argument("--manifest", default="docs/upstream-merge/exclusions.txt")
    ap.add_argument("--check", action="store_true", help="rapport seul, aucune mutation")
    a = ap.parse_args()

    repo = a.repo or git(".", "rev-parse", "--show-toplevel").strip()
    manifest = Path(repo) / a.manifest
    if not manifest.is_file():
        sys.exit("FAILED: manifeste introuvable : %s" % manifest)

    purged, excluded, warn, excluded_reviewed = parse_manifest(manifest)
    if not purged or not excluded:
        sys.exit("FAILED: manifeste vide ou mal formé (purged=%d excluded=%d)"
                 % (len(purged), len(excluded)))
    forbidden = sorted(set(purged) | set(excluded))

    merging = (Path(repo) / ".git" / "MERGE_HEAD").exists() or \
        bool(git(repo, "rev-parse", "-q", "--verify", "MERGE_HEAD", ok=False).strip())
    print("=== Résolution mécanique de fusion amont ===")
    print("  dépôt     : %s" % repo)
    print("  manifeste : %s" % a.manifest)
    print("  fusion en cours : %s%s" % ("oui" if merging else "NON",
                                        "" if merging else "  (lancez `git merge <tag>` d'abord)"))
    print("  interdits : %d chemins (%d purgés + %d exclus)"
          % (len(forbidden), len(purged), len(excluded)))

    unmerged = [l.strip() for l in
                git(repo, "diff", "--name-only", "--diff-filter=U").splitlines() if l.strip()]
    print("\n-- conflits détectés : %d --" % len(unmerged))

    mechanical = [p for p in unmerged if p in forbidden]
    content = [p for p in unmerged if p not in forbidden]
    print("  traités par le manifeste (garder supprimé) : %d" % len(mechanical))
    print("  conflits de CONTENU à arbitrer (humain)    : %d" % len(content))

    # fichiers exclus arrivés SANS conflit (donc présents dans l'arbre après fusion)
    silent = [p for p in forbidden
              if (Path(repo) / p).is_file() and p not in unmerged]
    print("  exclus arrivés sans conflit                : %d" % len(silent))

    # --- Porte EXCLU-MODIFIÉ (politique du fork) ---
    # Supprimer un fichier EXCLU à l'aveugle est interdit s'il porte encore du
    # contenu que la release amont a TOUCHÉ depuis la dernière release fusionnée
    # (piège fondateur : `SpacesTree.tsx` exclu alors qu'il portait le menu
    # d'actions note). Les PURGÉS (suppressions de fonctionnalité assumées) ne
    # sont pas bloqués : on les veut partis, point. L'exclusion ne devient
    # licite qu'APRÈS lecture du diff amont + traçabilité `[excluded-reviewed]`
    # (tag-amont date décision). Voir docs/upstream-merge/README.md.
    upstream_ref = None
    if merging:
        out, _, _ = run(["git", "-C", repo, "rev-parse", "--verify", "MERGE_HEAD"])
        upstream_ref = out.strip() or None
    if upstream_ref:
        out, err, rc = run(["git", "-C", repo, "merge-base", "HEAD", upstream_ref])
        base_ref = out.strip() if rc == 0 else None
    else:
        base_ref = None

    def upstream_touched(path):
        """True si la release amont a modifié/ajouté `path` depuis la base."""
        if not base_ref:
            return None
        out, err, rc = run(["git", "-C", repo, "diff", "--name-only", base_ref, upstream_ref, "--", path])
        if rc != 0:
            return None
        return bool(out.strip())

    protected, unknown = [], []
    for p in sorted(set(mechanical) | set(silent)):
        if p not in excluded:
            continue  # purgé : suppression voulue, non bloquée
        touched = upstream_touched(p)
        if touched is None:
            unknown.append(p)  # base inconnue (merge-base introuvable) : on laisse passer, on signale
        elif touched and p not in excluded_reviewed:
            protected.append(p)

    if protected:
        print("\n-- BLOQUÉ (EXCLU-MODIFIÉ, non tracé) : %d --" % len(protected))
        for p in protected:
            print("   ! %s : l'amont l'a modifié depuis %s — NE PAS SUPPRIMER" % (p, (base_ref or "?")[:12]))
            print("     lire le diff amont (voir le rapport de fork), porter ce qui est portable,")
            print("     puis tracer l'exclusion :  %s  # %s <date> <décision>"
                  % (p, (upstream_ref or "?")[:40]))
        if a.check:
            print("   (--check : pas de suppression ; en mode normal la fusion serait bloquée)")
    if unknown:
        print("\n-- AVERTI : %d exclu(s) sans base de comparaison, suppression non vérifiée --" % len(unknown))
        for p in unknown:
            print("   ? %s" % p)

    removed, failures = [], []
    deletable = sorted(set(mechanical) | set(silent))
    if not a.check:
        for p in deletable:
            if p in protected:
                continue  # bloqué : on ne supprime pas un exclu-modifié non tracé
            out, err, rc = run(["git", "-C", repo, "rm", "-f", "-q", "--ignore-unmatch", "--", p])
            if rc != 0:
                failures.append((p, err.strip()))
            else:
                removed.append(p)
        print("\n-- supprimés : %d / %d (%d bloqué(s)) --"
              % (len(removed), len(deletable), len(deletable) - len(removed)))
        for p, e in failures[:10]:
            print("   ! échec %s : %s" % (p, e))

    # assertions
    print("\n-- assertions --")
    # Les exclus BLOQUÉS sont volontairement restés dans l'arbre : l'arbitrage
    # (portage puis exclusion tracée) n'est pas fait. On les sort de la
    # violation « chemin interdit encore présent » — ce sont des points à
    # ARBITRER, pas des échecs de résolution — et le code de sortie 1 vient
    # de la liste `protected`, qui est explicable.
    present = [p for p in forbidden if (Path(repo) / p).exists() and p not in protected]
    if protected:
        print("   %d exclu(s)-modifié(s) conservé(s) volontairement — à arbitrer (voir ci-dessus)" % len(protected))
    if present:
        print("   ECHEC : %d chemin(s) interdit(s) encore présent(s)" % len(present))
        for p in present[:10]:
            print("      %s" % p)
    else:
        print("   OK : aucun chemin du manifeste n'est présent (%d vérifiés)" % len(forbidden))

    # Références orphelines laissées par les suppressions : pour chaque
    # importation RELATIVE présente dans l'arbre, la cible est résolue sur le
    # disque. Aucun rapprochement par nom de fichier ou par chaîne : un
    # identifiant de fournisseur ("corti") n'est pas une importation de
    # `corti.ts`, et un module supprimé peut être cité en commentaire sans que
    # le fichier soit cassé.
    dangling = scan_dangling_specifiers(repo)
    if dangling:
        total = sum(len(v) for v in dangling.values())
        print("   ECHEC : %d fichier(s) importent %d cible(s) absente(s) du disque :"
              % (len(dangling), total))
        for path in sorted(dangling, key=lambda k: (-len(dangling[k]), k)):
            for lineno, spec in dangling[path][:20]:
                print("      %s:%d  %s" % (path, lineno, spec))
            if len(dangling[path]) > 20:
                print("      %s  … %d de plus" % (path, len(dangling[path]) - 20))
    else:
        print("   OK : aucune importation relative ne pointe vers une cible absente")

    # alertes non destructives sur les motifs
    tracked = [l for l in git(repo, "ls-files").splitlines() if l.strip()]
    hits = sorted(p for p in tracked if p not in forbidden
                  and any(fnmatch.fnmatch(p.lower(), w) for w in warn))
    if hits:
        print("\n-- À RELIRE : %d fichier(s) ressemblant à la couche exclue "
              "(motifs [warn], NON supprimés) --" % len(hits))
        for p in hits[:40]:
            print("     %s" % p)

    print("\n-- suite --")
    if protected:
        print("  %d exclu(s)-modifié(s) à arbitrer : lire le diff amont (rapport de fork)," % len(protected))
        print("  porter ce qui est portable, puis tracer l'exclusion dans [excluded-reviewed].")
        print("  La fusion reste BLOQUÉE tant qu'ils ne sont ni portés ni tracés.")
    if content:
        print("  %d conflit(s) de contenu à arbitrer :" % len(content))
        for p in content:
            print("     %s" % p)
    print("  puis : npm ci (Node 24, cf .nvmrc) && npm test && npm run lint "
          "&& npm run typecheck && npm run build:renderer")
    print("  puis : PR pour merge humain")

    if protected or present or failures or dangling:
        return 1
    if content:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
