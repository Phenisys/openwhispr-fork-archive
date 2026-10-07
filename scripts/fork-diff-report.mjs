#!/usr/bin/env node
/**
 * Rapport de DIFF DE FORK — aide à l'arbitrage d'une fusion amont.
 *
 * Principe : la source de vérité est le repo officiel. Nos customisations
 * (BYOK / local / self-hosted, marque, i18n, défauts locaux) s'appliquent PAR-DESSUS.
 *
 * Cet outil est déterministe (aucun LLM) : il ne lit que des DIFFS, jamais le
 * contenu complet d'un fichier. Il répond à la question « parmi nos
 * modifications, lesquelles interagissent avec les changements de la release
 * amont, et de quelle manière ? ».
 *
 * Les trois entrées du 3-way d'un `git merge <tag-amont>` :
 *   base     = merge-base(ours, upstream) = la dernière release amont fusionnée
 *   ours     = HEAD = notre main AVANT le merge (nos customisations cumulées)
 *   upstream = MERGE_HEAD = la release amont en cours de fusion
 *
 * Chaque hunk de notre delta fork est classé face au delta amont :
 *   SANS CONFLIT  — l'amont n'a pas touché les lignes que nous modifions :
 *                    nos mods survivent au 3-way, rien à faire (agrégé).
 *   COLLISION     — l'amont a réécrit les MÊMES lignes que nous. Deux cas :
 *                    · c'est une SPÉCIFICITÉ assumée (BYOK / local / self-hosted,
 *                      marque, i18n) → on la ré-applique PAR-DESSUS l'amont ;
 *                    · c'est un FIX que l'amont a aussi corrigé → la source de
 *                      vérité gagne : on GARDE l'amont et on retire notre patch.
 *   EXCLU-MODIFIÉ — le fichier est du manifeste d'exclusion (couche cloud) MAIS
 *                    l'amont l'a MODIFIÉ depuis la base. NE PAS le supprimer à
 *                    l'aveugle : lire le diff amont d'abord (le résolveur
 *                    bloque tant que la relecture n'est pas tracée dans
 *                    `[excluded-reviewed]`).
 *
 * Lisibilité : seuls les fichiers de **source** sont développés ; les collisions
 * de tests, locales et outillage (mécaniques) sont agrégées en compte.
 *
 * Usage (pendant un merge en cours) :
 *   node scripts/fork-diff-report.mjs --upstream MERGE_HEAD
 *   node scripts/fork-diff-report.mjs --upstream refs/tmp/upstream-v1.10.2
 *   node scripts/fork-diff-report.mjs --base X --ours Y --upstream Z --report f.md
 *
 * Codes de retour : 0 = pas de collision ni d'exclu-modifié ; 1 = arbitrage
 * requis ; 2 = usage / erreur.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MANIFEST = "docs/upstream-merge/exclusions.txt";

/** Domaine de la couche exclue : sert à prioriser / classer les hunks. */
const CLOUD_HINTS =
  /space|share|workspace|team|invit|cloud|signin|signedin|useauth|permission|\bacl\b|roster|billing|subscription|entitlement|enterprise|managed|sync|account|referral|leaderboard|insight|usage|upgrade|plan\b|paid|pricing|stripe|oauth|jwt|bearer/i;

/** Motifs des spécificités Phenisys assumées : suggère le sens d'un hunk. */
const SPEC_HINTS =
  /phenisys|byok|self.?host|local|bordeaux|brand|fork|nous|notre|Phenisys/i;

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitMaybe(args, opts = {}) {
  try {
    return git(args, opts);
  } catch (err) {
    if (err.status === 1) return "";
    throw err;
  }
}

function parseArgs(argv) {
  const out = { upstream: null, ours: "HEAD", base: null, report: null, quiet: false, maxContext: 6 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--upstream") out.upstream = argv[++i];
    else if (arg === "--ours") out.ours = argv[++i];
    else if (arg === "--base") out.base = argv[++i];
    else if (arg === "--report") out.report = argv[++i];
    else if (arg === "--max-context") out.maxContext = parseInt(argv[++i], 10);
    else if (arg === "--quiet") out.quiet = true;
    else if (arg === "-h" || arg === "--help") out.help = true;
  }
  return out;
}

function loadManifest(root) {
  const file = resolve(root, MANIFEST);
  if (!existsSync(file)) return { excluded: [], sections: {} };
  const sections = {};
  let section = "purged";
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^\[(purged|excluded|warn|excluded-reviewed)\]/);
    if (header) {
      section = header[1];
      sections[section] = sections[section] || [];
      continue;
    }
    if (line.startsWith("#")) continue;
    sections[section] = sections[section] || [];
    sections[section].push(line.replace(/\+$/, ""));
  }
  const excluded = [...(sections.purged || []), ...(sections.excluded || [])];
  return { excluded, sections };
}

function isExcluded(path, excluded) {
  return excluded.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

/** Classe un fichier : seul le `source` est développé dans le rapport. */
function classifyFile(file) {
  if (/(^|\/)test\/|\.test\.(js|ts|mjs|cjs)$|\.spec\.(js|ts)$/.test(file)) return "test";
  if (/\/locales\//.test(file)) return "locale";
  if (/^(\.github\/|\.superpowers\/|docs\/|\.nvmrc|package\.json|package-lock\.json|README\.md)/.test(file))
    return "tooling";
  return "source";
}

/**
 * Parse un `git diff -U<n> <a> <b> -- <fichier>` en hunks, en coordonnées du
 * fichier A (la base). Chaque hunk porte `oldChanged` : les numéros de LIGNE
 * du fichier de base que ce hunk MODIFIE (les lignes « - »), c'est-à-dire la
 * zone réellement touchée — pas le contexte. Retourne null si le fichier est
 * identique ou binaire.
 */
function parseHunks(diffText, file) {
  const lines = diffText.split("\n");
  const hunks = [];
  let inFile = false;
  let cur = null;
  let oldPos = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("diff --git ")) {
      inFile = line.includes(` b/${file}`) || line.includes(` a/${file}`);
      cur = null;
      oldPos = null;
      continue;
    }
    if (!inFile) continue;
    if (/^Binary files/.test(line) || /^\(Binary/.test(line)) return null;
    const hunkHeader = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkHeader) {
      const oldStart = parseInt(hunkHeader[1], 10);
      const oldCount = hunkHeader[2] === undefined ? 1 : parseInt(hunkHeader[2], 10);
      cur = {
        oldStart,
        oldEnd: oldStart + Math.max(oldCount, 1) - 1,
        newStart: parseInt(hunkHeader[3], 10),
        oldChanged: [],
        body: [],
      };
      oldPos = oldStart;
      hunks.push(cur);
      continue;
    }
    if (!cur) continue;
    const next = lines[i + 1];
    if (next && (next.startsWith("diff --git ") || next.startsWith("@@"))) {
      cur.body.push(line);
      cur = null;
      continue;
    }
    const marker = line[0];
    if (marker === " " || marker === "-") {
      if (marker === "-") cur.oldChanged.push(oldPos);
      oldPos += 1;
      cur.body.push(line);
    } else if (marker === "+") {
      cur.body.push(line);
    }
    // « --- »/« +++ » de séparation : ni contexte ni changement, on ignore
  }
  return hunks.length ? hunks : null;
}

/** Diff d'un seul fichier entre deux refs (contexte pour l'affichage). */
function fileDiff(root, a, b, file, context) {
  return gitMaybe(["diff", `-U${context}`, a, b, "--", file], { cwd: root });
}

/** Vrai si les lignes modifiées de `forkHunk` intersectent la boîte [s,e] d'un hunk amont. */
function changedLinesIntersect(forkHunk, s, e, tolerance = 1) {
  return forkHunk.oldChanged.some((p) => p >= s - tolerance && p <= e + tolerance);
}

function suggestMeaning(forkHunk, upHunks) {
  const text = [...forkHunk.body, ...upHunks.flatMap((u) => u.body)].join("\n");
  const cloud = CLOUD_HINTS.test(text);
  const spec = SPEC_HINTS.test(text);
  if (cloud && !spec)
    return "l'amont y introduit de la couche exclue — probablement à écourter plutôt qu'à réappliquer.";
  if (spec && !cloud) return "resemble à une spécificité fork — candidate à la ré-application par-dessus l'amont.";
  if (spec && cloud) return "mélangé — à juger hunk par hunk.";
  return "sens non évident — juger au contexte.";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.upstream) {
    process.stderr.write(
      "Usage : node scripts/fork-diff-report.mjs --upstream <ref> [--ours HEAD] [--base <ref>] [--report <f.md>] [--max-context N] [--quiet]\n"
    );
    process.exit(2);
  }

  const root = git(["rev-parse", "--show-toplevel"]).trim();
  const upstream = args.upstream;
  const ours = args.ours;
  let base = args.base;
  if (!base) {
    try {
      base = git(["merge-base", ours, upstream], { cwd: root }).trim();
    } catch {
      base = "";
    }
  }
  if (!base) {
    process.stderr.write(
      "Impossible de déterminer la base (merge-base) — passez --base <tag-de-la-dernière-release-fusionnée>.\n"
    );
    process.exit(2);
  }

  for (const ref of [base, ours, upstream]) {
    try {
      git(["rev-parse", "--verify", `${ref}^{commit}`], { cwd: root });
    } catch {
      process.stderr.write(`Référence introuvable : ${ref}\n`);
      process.exit(2);
    }
  }

  const { excluded } = loadManifest(root);

  // ── deltas ─────────────────────────────────────────────────────────────────
  const forkFiles = [...new Set(gitMaybe(["diff", "--name-only", "-M", base, ours, "--", "."], { cwd: root }).split("\n").filter(Boolean))];
  const upstreamFiles = [...new Set(gitMaybe(["diff", "--name-only", "-M", base, upstream, "--", "."], { cwd: root }).split("\n").filter(Boolean))];
  const upstreamSet = new Set(upstreamFiles);
  const both = forkFiles.filter((f) => upstreamSet.has(f));

  const forkOnly = forkFiles.filter((f) => !upstreamSet.has(f));
  const upstreamOnly = upstreamFiles.filter((f) => !new Set(forkFiles).has(f));

  // ── classification ─────────────────────────────────────────────────────────
  let cleanHunks = 0;
  const collisions = []; // { file, class, forkHunk, upHunks, meaning }
  const excludedModified = []; // { file, upHunks, upStat }
  let forkHunksTotal = 0;

  for (const file of both) {
    const cls = classifyFile(file);
    const isExcl = isExcluded(file, excluded);
    const forkHunks = isExcl ? [] : (parseHunks(fileDiff(root, base, ours, file, 1), file) || []);
    const upHunks = parseHunks(fileDiff(root, base, upstream, file, 1), file) || [];

    if (isExcl) {
      if (upHunks.length > 0) excludedModified.push({ file, upHunks });
      continue;
    }

    for (const fh of forkHunks) {
      forkHunksTotal += 1;
      const touching = upHunks.filter((uh) => changedLinesIntersect(fh, uh.oldStart, uh.oldEnd));
      if (touching.length === 0) {
        cleanHunks += 1;
      } else {
        collisions.push({ file, class: cls, forkHunk: fh, upHunks: touching, meaning: suggestMeaning(fh, touching) });
      }
    }
  }

  const byClass = (c) => collisions.filter((x) => x.class === c);
  const sourceCollisions = byClass("source");
  const testCollisions = byClass("test");
  const localeCollisions = byClass("locale");
  const toolingCollisions = byClass("tooling");
  const sourceFiles = [...new Set(sourceCollisions.map((c) => c.file))];
  const breachCount = sourceFiles.length + excludedModified.length;
  const verdict =
    breachCount === 0
      ? "✅ nos modifications s'appliquent proprement sur l'amont"
      : `❌ ${sourceFiles.length} fichier(s) source + ${excludedModified.length} exclu(s)-modifié(s) à arbitrer`;

  // ── rapport ────────────────────────────────────────────────────────────────
  const L = [];
  const label = upstream.replace(/^refs\/(tmp\/upstream-|tags\/)/, "").replace(/^MERGE_HEAD$/, "(MERGE_HEAD)");
  L.push(`# Diff de fork — arbitrage de la fusion ${label}`);
  L.push("");
  L.push(
    `base=\`${base}\` (dernière release fusionnée) · ours=\`${ours}\` (nos customisations) · upstream=\`${upstream}\` (la release).`
  );
  L.push("");
  L.push(
    "Règle : **la source de vérité est le repo officiel**, nos customisations (BYOK / local / self-hosted, marque, i18n) s'appliquent par-dessus. Chaque hunk de notre delta fork est classé face au delta amont ; seuls les fichiers de source sont développés."
  );
  L.push("");
  L.push(`**Verdict : ${verdict}**`);
  L.push("");

  L.push("## Table de verdict (10 min)");
  L.push("");
  L.push("| État | Fichiers | Hunks | Action |");
  L.push("|---|---|---|---|");
  L.push(`| SANS CONFLIT | ${forkOnly.length + (both.length - new Set(collisions.map((c) => c.file)).size)} | ${cleanHunks} | rien — nos mods survivent au 3-way |`);
  L.push(`| COLLISION (source) | **${sourceFiles.length}** | ${sourceCollisions.length} | §2 : spécificité → réappliquer · fix corrigé amont → garder l'amont |`);
  L.push(`| COLLISION (test/locale/outillage) | ${new Set([...testCollisions, ...localeCollisions, ...toolingCollisions].map((c) => c.file)).size} | ${testCollisions.length + localeCollisions.length + toolingCollisions.length} | mécanique — §3, valider en bloc |`);
  L.push(`| EXCLU-MODIFIÉ | **${excludedModified.length}** | — | §1 : lire le diff amont AVANT d'exclure |`);
  L.push(`| (info) ajoutés amont seulement | ${upstreamOnly.length} | — | voir l'audit de parité |`);
  L.push("");

  if (excludedModified.length > 0) {
    L.push("## 1. Fichiers du manifeste que la release amont a modifiés");
    L.push("");
    L.push(
      "Exclus (couche cloud) MAIS modifiés par l'amont : ne **pas** supprimer à l'aveugle. Lire le diff ci-dessous, porter éventuellement une fonctionnalité non-cloud vers notre équivalent local, puis exclure **tracé** (`[excluded-reviewed]`)."
    );
    L.push("");
    for (const { file, upHunks } of excludedModified) {
      L.push(`### \`${file}\` — ${upHunks.length} hunk(s) amont`);
      L.push("");
      L.push("```diff");
      const text = fileDiff(root, base, upstream, file, args.maxContext);
      for (const line of text.split("\n")) L.push(line);
      L.push("```");
      L.push("");
      L.push("→ _portable, ou exclus avec raison (tracé) ?_");
      L.push("");
    }
  } else {
    L.push("## 1. Fichiers du manifeste modifiés par l'amont : **aucun**");
    L.push("");
  }

  L.push(`## 2. Collisions — fichiers de source (${sourceFiles.length})`);
  L.push("");
  L.push(
    "L'amont a réécrit les mêmes lignes que nous. Décider par hunk : **spécificité assumée** → réappliquer par-dessus l'amont ; **fix que l'amont a déjà corrigé** → garder l'amont (source de vérité), retirer notre patch."
  );
  L.push("");
  if (sourceFiles.length === 0) L.push("_Aucune collision en source._");
  for (const file of sourceFiles) {
    const entries = sourceCollisions.filter((c) => c.file === file);
    L.push(`### \`${file}\` — ${entries.length} hunk(s) en collision`);
    L.push("");
    L.push("```diff");
    const text = fileDiff(root, base, ours, file, args.maxContext);
    const upText = fileDiff(root, base, upstream, file, args.maxContext);
    L.push(`# ── NOS LIGNES (fork, ${base.slice(0, 8)} → ${ours}) ──`);
    for (const line of text.split("\n")) L.push(line);
    L.push(`# ── LIGNES AMONT (la release, ${base.slice(0, 8)} → ${upstream}) ──`);
    for (const line of upText.split("\n")) L.push(line);
    L.push("```");
    L.push("");
    for (const e of entries) L.push(`- hunk lignes ${e.forkHunk.oldStart}–${e.forkHunk.oldEnd} : ${e.meaning}`);
    L.push("");
  }

  L.push("## 3. Collisions mécaniques (agrégées)");
  L.push("");
  L.push("| Catégorie | Fichiers | Hunks |");
  L.push("|---|---|---|");
  L.push(`| test | ${new Set(testCollisions.map((c) => c.file)).size} | ${testCollisions.length} |`);
  L.push(`| locale | ${new Set(localeCollisions.map((c) => c.file)).size} | ${localeCollisions.length} |`);
  L.push(`| outillage (CI/docs/lockfile) | ${new Set(toolingCollisions.map((c) => c.file)).size} | ${toolingCollisions.length} |`);
  L.push("");
  const mechFiles = [...new Set([...testCollisions, ...localeCollisions, ...toolingCollisions].map((c) => c.file))];
  if (mechFiles.length > 0) {
    L.push("<details><summary>Fichiers (valider en bloc — re-écritures locales / i18n)</summary>");
    L.push("");
    for (const f of mechFiles) L.push(`- \`${f}\``);
    L.push("");
    L.push("</details>");
    L.push("");
  }

  L.push("## Récap");
  L.push("");
  L.push(`- delta fork (base→ours) : **${forkFiles.length}** fichiers`);
  L.push(`- delta amont (base→upstream) : **${upstreamFiles.length}** fichiers`);
  L.push(`- touchés par les deux : ${both.length}`);
  L.push(`- hunks fork analysés : ${forkHunksTotal} (sans collision : ${cleanHunks})`);
  L.push(`- collisions : **${collisions.length}** hunks (source ${sourceCollisions.length})`);
  L.push(`- exclus modifiés : **${excludedModified.length}**`);
  L.push("");
  L.push(
    "Le 3-way de `git merge` a déjà fusionné les régions non-collidantes : seuls ces points demandent un œil. Le rapport est déterministe ; l'adjudication « spécificité vs fix amont » reste l'arbitrage humain."
  );

  const report = L.join("\n");
  const reportPath = args.report ? resolve(root, args.report) : resolve(root, `docs/upstream-merge/fork-diff-${label}.md`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${report}\n`);

  if (!args.quiet) {
    process.stdout.write(
      [
        `fork-diff : base=${base.slice(0, 8)} ours=${ours} upstream=${upstream}`,
        `  delta fork    : ${forkFiles.length} fichier(s)`,
        `  delta amont   : ${upstreamFiles.length} fichier(s)`,
        `  sans conflit  : ${cleanHunks} hunk(s)`,
        `  COLLISION src : ${sourceCollisions.length} hunk(s) dans ${sourceFiles.length} fichier(s)`,
        `  COLLISION meca: ${testCollisions.length + localeCollisions.length + toolingCollisions.length} hunk(s) (agrégés)`,
        `  EXCLU-MODIF   : ${excludedModified.length} fichier(s)`,
        `  rapport       : ${reportPath.replace(`${root}/`, "")}`,
        `  verdict       : ${verdict}`,
        "",
      ].join("\n")
    );
    for (const { file } of excludedModified) process.stdout.write(`  ! exclu-modifié ${file}\n`);
    for (const f of sourceFiles) process.stdout.write(`  ! collision ${f}\n`);
  }

  process.exit(breachCount === 0 ? 0 : 1);
}

main();
