#!/usr/bin/env node
/**
 * Audit de PARITÉ FONCTIONNELLE avec l'amont (OpenWhispr/openwhispr).
 *
 * Règle de la fusion amont : on intègre D'ABORD toutes les fonctionnalités de la
 * version officielle, PUIS on réapplique nos spécificités (BYOK / local /
 * self-hosted). Un fichier exclu par `docs/upstream-merge/exclusions.txt` ne
 * justifie jamais de perdre une fonctionnalité NON-cloud qu'il portait.
 *
 * Cet outil est déterministe (aucun LLM) : il constate, il ne juge pas.
 * Il répond à quatre questions, après un `git merge <tag-amont>` :
 *
 *   1. Quels fichiers l'amont ajoute-t-il et que nous n'avons pas ?
 *      → un chemin NON listé dans le manifeste d'exclusion est un OUBLI potentiel.
 *   2. Dans les fichiers communs, combien de lignes l'amont a-t-il que nous
 *      n'avons pas ? → chaque fichier listé doit être arbitré à la main
 *      (porté / exclu / non applicable), jamais absorbé en silence.
 *   3. Quelles chaînes d'interface l'amont utilise-t-il (`t("...")`) et qui
 *      n'apparaissent plus nulle part chez nous ? → écran ou action disparus.
 *   4. Les fonctionnalités du contrat de parité (`parity-checks.txt`) sont-elles
 *      présentes chez nous ?
 *
 * Usage :
 *   node scripts/upstream-parity-audit.mjs --tag v1.10.2 --fetch
 *   node scripts/upstream-parity-audit.mjs --upstream refs/tmp/upstream-v1.10.2
 *   node scripts/upstream-parity-audit.mjs --tag v1.10.2 --report docs/upstream-merge/parity-v1.10.2.md
 *
 * Codes de retour : 0 = parité vérifiée ; 1 = arbitrage requis ; 2 = usage.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const UPSTREAM_URL = "https://github.com/OpenWhispr/openwhispr.git";
const MANIFEST = "docs/upstream-merge/exclusions.txt";
const CHECKS = "docs/upstream-merge/parity-checks.txt";

/** Domaine de la couche exclue : sert UNIQUEMENT à prioriser la relecture. */
const CLOUD_HINTS =
  /space|share|workspace|team|invit|cloud|signin|signedin|useauth|permission|\bacl\b|roster|billing|subscription|entitlement|enterprise|managed|sync|account|referral|leaderboard|insight|usage|upgrade|plan\b|paid|pricing|stripe|oauth|jwt|bearer/i;

/** Namespaces i18n attendus comme absents (couche exclue). Informatif seulement. */
const EXPECTED_ABSENT_NAMESPACES = new Set([
  "auth",
  "workspaces",
  "insights",
  "referral",
  "apiKeysSection",
  "forgotPassword",
  "emailVerification",
  "WorkspaceSection",
  "billing",
  "onboarding",
  "settingsPage",
  "sidebar",
]);

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: opts.cwd,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseArgs(argv) {
  const out = { tag: null, upstream: null, fetch: false, report: null, ours: "HEAD", quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tag") out.tag = argv[++i];
    else if (arg === "--upstream") out.upstream = argv[++i];
    else if (arg === "--report") out.report = argv[++i];
    else if (arg === "--ours") out.ours = argv[++i];
    else if (arg === "--fetch") out.fetch = true;
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
    const header = line.match(/^\[(purged|excluded|warn)\]/);
    if (header) {
      section = header[1];
      sections[section] = sections[section] || [];
      continue;
    }
    if (line.startsWith("#")) continue;
    sections[section] = sections[section] || [];
    sections[section].push(line.replace(/\/+$/, ""));
  }
  // [purged] et [excluded] sont des exclusions DÉCIDÉES ; [warn] n'est qu'une alerte.
  const excluded = [...(sections.purged || []), ...(sections.excluded || [])];
  return { excluded, sections };
}

function isExcluded(path, excluded) {
  return excluded.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function loadChecks(root) {
  const file = resolve(root, CHECKS);
  if (!existsSync(file)) return [];
  const checks = [];
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [id, needle, globs, waiver] = line.split("|").map((part) => (part ?? "").trim());
    if (!id || !needle) continue;
    checks.push({
      id,
      needle,
      globs: (globs || "src").split(",").map((g) => g.trim()).filter(Boolean),
      waived: /^waived=/i.test(waiver) ? waiver.replace(/^waived=/i, "") : null,
    });
  }
  return checks;
}

function grepFiles(ref, needle, globs, root) {
  // -n pour connaître la ligne : une aiguille qui n'apparaît que dans un
  // commentaire ne prouve rien (un commentaire « le menu NewNoteMenu a été
  // purgé » ne vaut pas la fonctionnalité).
  const args = ["grep", "-F", "-n", "-e", needle, ref, "--", ...globs];
  let out;
  try {
    out = git(args, { cwd: root });
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
  const isComment = (text) => /^\s*(\/\/|\/\*|\*|#|<!--)/.test(text);
  return out
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      // « <ref>:<chemin>:<ligne>:<texte> » — le préfixe de réf contient lui aussi
      // des « : », donc on laisse l'expression revenir en arrière jusqu'au
      // premier « :<chiffres>: » valide.
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      return match ? !isComment(match[3]) : true;
    });
}

function usedI18nKeys(ref, root) {
  // t("a.b.c") et i18nKey: "a.b.c" — deux formes utilisées par le projet.
  const out = new Set();
  const patterns = [/t\("([A-Za-z0-9_.]+)"/g, /(?:translation_key|i18nKey|labelKey):\s*"([A-Za-z0-9_.]+)"/g];
  for (const source of ["src"]) {
    let text;
    try {
      text = git(["grep", "-h", "-E", 't\\("[A-Za-z0-9_.]+"|translation_key: *"[A-Za-z0-9_.]+"', ref, "--", source], {
        cwd: root,
      });
    } catch (err) {
      if (err.status === 1) continue;
      throw err;
    }
    for (const line of text.split("\n")) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) out.add(match[1]);
      }
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.tag && !args.upstream)) {
    process.stderr.write(
      "Usage : node scripts/upstream-parity-audit.mjs (--tag <vX.Y.Z> [--fetch] | --upstream <ref>) [--ours HEAD] [--report <fichier.md>]\n"
    );
    process.exit(2);
  }

  const root = git(["rev-parse", "--show-toplevel"]).trim();
  const upstreamRef = args.upstream || `refs/tmp/upstream-${args.tag}`;

  if (args.tag && args.fetch) {
    process.stderr.write(`→ git fetch ${UPSTREAM_URL} ${args.tag}\n`);
    git(["fetch", "--no-tags", UPSTREAM_URL, `refs/tags/${args.tag}:${upstreamRef}`], { cwd: root });
  }
  try {
    git(["rev-parse", "--verify", `${upstreamRef}^{commit}`], { cwd: root });
  } catch {
    process.stderr.write(
      `Référence amont introuvable : ${upstreamRef}\nAjoutez --fetch avec --tag <vX.Y.Z>, ou passez --upstream <ref>.\n`
    );
    process.exit(2);
  }

  const ours = args.ours;
  const label = args.tag || upstreamRef.replace(/^refs\/tmp\/upstream-/, "").replace(/^refs\/tags\//, "");
  const { excluded, sections } = loadManifest(root);

  // ── 1. fichiers de l'amont absents chez nous ────────────────────────────────
  const status = git(["diff", "--name-status", "-M", ours, upstreamRef], { cwd: root });
  const upstreamOnly = [];
  const oursOnly = [];
  const shared = [];
  for (const line of status.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const [code, path] = parts;
    if (code === "A") upstreamOnly.push(path);
    else if (code === "D") oursOnly.push(path);
    else if (code === "M") shared.push(path);
  }
  const unclassified = upstreamOnly.filter((path) => !isExcluded(path, excluded));

  // ── 2. lignes de l'amont absentes dans les fichiers communs ─────────────────
  const diff = git(["diff", "-U0", ours, upstreamRef, "--", "."], { cwd: root });
  const perFile = new Map();
  let current = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      current = line.slice(6);
      continue;
    }
    if (!current || !line.startsWith("+") || line.startsWith("+++")) continue;
    const entry = perFile.get(current) || { total: 0, plain: [] };
    entry.total += 1;
    const body = line.slice(1);
    if (body.trim() && !CLOUD_HINTS.test(body)) entry.plain.push(body.trim());
    perFile.set(current, entry);
  }
  const sharedWithUpstreamOnly = shared
    .map((path) => ({ path, ...(perFile.get(path) || { total: 0, plain: [] }) }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.plain.length - a.plain.length || b.total - a.total);

  // ── 3. clés i18n utilisées par l'amont, absentes de notre code ──────────────
  const upstreamKeys = usedI18nKeys(upstreamRef, root);
  const ourKeys = usedI18nKeys(ours, root);
  const droppedKeys = [...upstreamKeys].filter((key) => !ourKeys.has(key)).sort();
  const droppedByNamespace = new Map();
  for (const key of droppedKeys) {
    const ns = key.split(".")[0] || "(racine)";
    if (!droppedByNamespace.has(ns)) droppedByNamespace.set(ns, []);
    droppedByNamespace.get(ns).push(key);
  }

  // ── 4. contrat de parité fonctionnelle ─────────────────────────────────────
  const checks = loadChecks(root).map((check) => {
    const upstreamHits = grepFiles(upstreamRef, check.needle, check.globs, root);
    const ourHits = grepFiles(ours, check.needle, check.globs, root);
    let state;
    if (upstreamHits.length === 0) state = "PÉRIMÉ"; // l'amont ne contient plus l'aiguille
    else if (ourHits.length > 0) state = "OK";
    else if (check.waived) state = "DÉROGÉ";
    else state = "MANQUANT";
    return { ...check, state, upstreamHits, ourHits };
  });

  const breaches = [
    ...unclassified.map((path) => `fichier amont non classé : ${path}`),
    ...checks.filter((c) => c.state === "MANQUANT").map((c) => `fonctionnalité manquante : ${c.id}`),
    ...checks.filter((c) => c.state === "PÉRIMÉ").map((c) => `sonde périmée : ${c.id}`),
  ];

  // ── rapport ────────────────────────────────────────────────────────────────
  const lines = [];
  lines.push(`# Parité fonctionnelle avec l'amont ${label}`);
  lines.push("");
  lines.push(`Comparaison : \`${ours}\` (notre arbre) ← \`${upstreamRef}\` (OpenWhispr officiel).`);
  lines.push("");
  lines.push(
    `Règle : **intégrer d'abord toutes les fonctionnalités officielles, puis nos spécificités** ` +
      `(BYOK / local / self-hosted). Un chemin exclu par \`${MANIFEST}\` ne justifie pas de perdre ` +
      `une fonctionnalité non-cloud qu'il portait.`
  );
  lines.push("");
  const verdict = breaches.length === 0 ? "✅ parité vérifiée" : `❌ ${breaches.length} point(s) à arbitrer`;
  lines.push(`**Verdict : ${verdict}**`);
  lines.push("");
  if (breaches.length > 0) {
    lines.push("## À arbitrer");
    lines.push("");
    for (const breach of breaches) lines.push(`- ${breach}`);
    lines.push("");
  }

  lines.push("## 1. Fichiers officiels absents de notre arbre");
  lines.push("");
  lines.push(`| Total | Exclus par le manifeste | **Non classés (à tranche)** |`);
  lines.push(`|---|---|---|`);
  lines.push(`| ${upstreamOnly.length} | ${upstreamOnly.length - unclassified.length} | **${unclassified.length}** |`);
  lines.push("");
  if (unclassified.length > 0) {
    lines.push("Chemins présents dans l'amont et ni purgés ni exclus : soit on les porte, soit on les ajoute au manifeste avec une raison.");
    lines.push("");
    for (const path of unclassified) lines.push(`- \`${path}\``);
    lines.push("");
  }
  lines.push(`<details><summary>Fichiers de notre arbre absents de l'amont (${oursOnly.length})</summary>`);
  lines.push("");
  for (const path of oursOnly) lines.push(`- \`${path}\``);
  lines.push("");
  lines.push("</details>");
  lines.push("");

  lines.push("## 2. Fichiers communs où l'amont a des lignes que nous n'avons pas");
  lines.push("");
  lines.push(`Fichiers communs divergents : **${shared.length}**, dont **${sharedWithUpstreamOnly.length}** contiennent des lignes amont absentes chez nous.`);
  lines.push("La colonne « non-cloud » compte les lignes qui ne ressemblent PAS à la couche exclue : ce sont les candidates à la perte silencieuse de fonctionnalité.");
  lines.push("");
  lines.push("| Lignes amont absentes (non-cloud) | Lignes amont absentes (total) | Fichier |");
  lines.push("|---|---|---|");
  for (const entry of sharedWithUpstreamOnly.slice(0, 40)) {
    lines.push(`| ${entry.plain.length} | ${entry.total} | \`${entry.path}\` |`);
  }
  lines.push("");
  lines.push("<details><summary>Lignes non-cloud à relire (fichiers du domaine notes/réunions/panneau)</summary>");
  lines.push("");
  for (const entry of sharedWithUpstreamOnly) {
    if (!/notes|meeting|Meeting|ControlPanel|useAudioRecording/i.test(entry.path)) continue;
    if (entry.plain.length === 0) continue;
    lines.push(`### \`${entry.path}\``);
    lines.push("");
    lines.push("```diff");
    for (const line of entry.plain.slice(0, 60)) lines.push(`+ ${line}`);
    lines.push("```");
    lines.push("");
  }
  lines.push("</details>");
  lines.push("");

  lines.push("## 3. Clés d'interface utilisées par l'amont et plus nulle part chez nous");
  lines.push("");
  lines.push(
    `${droppedKeys.length} clés. Les namespaces de la couche exclue (${[...EXPECTED_ABSENT_NAMESPACES].join(", ")}) ` +
      `sont attendus ; tout le reste signale un écran ou une action disparus.`
  );
  lines.push("");
  lines.push("| Namespace | Clés | Attendu (couche exclue) |");
  lines.push("|---|---|---|");
  for (const [ns, keys] of [...droppedByNamespace].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`| \`${ns}\` | ${keys.length} | ${EXPECTED_ABSENT_NAMESPACES.has(ns) ? "oui" : "**non — à vérifier**"} |`);
  }
  lines.push("");
  const suspicious = [...droppedByNamespace].filter(([ns]) => !EXPECTED_ABSENT_NAMESPACES.has(ns));
  if (suspicious.length > 0) {
    lines.push("<details><summary>Clés hors couche exclue</summary>");
    lines.push("");
    for (const [ns, keys] of suspicious) {
      lines.push(`- \`${ns}\` : ${keys.map((k) => `\`${k}\``).join(", ")}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push("## 4. Contrat de parité fonctionnelle");
  lines.push("");
  lines.push(`Source : \`${CHECKS}\`.`);
  lines.push("");
  lines.push("| État | Fonctionnalité | Aiguille cherchée | Chez nous | Amont |");
  lines.push("|---|---|---|---|---|");
  for (const check of checks) {
    lines.push(
      `| ${check.state} | \`${check.id}\` | \`${check.needle}\` | ${check.ourHits.length} fichier(s) | ${check.upstreamHits.length} fichier(s) |`
    );
  }
  lines.push("");
  if (checks.some((c) => c.state === "PÉRIMÉ")) {
    lines.push("Une sonde « PÉRIMÉE » n'existe plus dans l'amont : mettez `parity-checks.txt` à jour, sinon le contrat ne protège plus rien.");
    lines.push("");
  }

  const report = lines.join("\n");
  const reportPath = args.report ? resolve(root, args.report) : resolve(root, `docs/upstream-merge/parity-${label}.md`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${report}\n`);

  if (!args.quiet) {
    process.stdout.write(
      [
        `Amont ${label} ← ${ours}`,
        `  fichiers amont absents      : ${upstreamOnly.length} (non classés : ${unclassified.length})`,
        `  fichiers communs divergents : ${shared.length} (avec lignes amont absentes : ${sharedWithUpstreamOnly.length})`,
        `  clés i18n orphelines        : ${droppedKeys.length}`,
        `  contrat de parité           : ${checks.filter((c) => c.state === "OK").length}/${checks.length} OK`,
        `  rapport                     : ${reportPath.replace(`${root}/`, "")}`,
        `  verdict                     : ${verdict}`,
        "",
      ].join("\n")
    );
    for (const breach of breaches) process.stdout.write(`  ! ${breach}\n`);
  }

  process.exit(breaches.length === 0 ? 0 : 1);
}

main();
