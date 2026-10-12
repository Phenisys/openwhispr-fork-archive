<p align="center">
  <img src="src/assets/logo.svg" alt="OpenWhispr" width="120" />
</p>

<h1 align="center">OpenWhispr</h1>

<p align="center">
  <a href="https://github.com/OpenWhispr/openwhispr/blob/main/LICENSE"><img src="https://img.shields.io/github/license/OpenWhispr/openwhispr?style=flat" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat" alt="Platform" />
  <a href="https://github.com/OpenWhispr/openwhispr/releases/latest"><img src="https://img.shields.io/github/v/release/OpenWhispr/openwhispr?style=flat&sort=semver" alt="GitHub release" /></a>
  <a href="https://github.com/OpenWhispr/openwhispr/releases"><img src="https://img.shields.io/github/downloads/OpenWhispr/openwhispr/total?style=flat&color=blue" alt="Downloads" /></a>
  <a href="https://github.com/OpenWhispr/openwhispr/stargazers"><img src="https://img.shields.io/github/stars/OpenWhispr/openwhispr?style=flat" alt="GitHub stars" /></a>
</p>

<p align="center">
  The open-source and free alternative to WisprFlow and Granola.<br/>
  Privacy-first voice-to-text dictation with AI agents, meeting transcription, and notes. Cross-platform for macOS, Windows, and Linux.
</p>

> **Fork Phenisys** — ce dépôt est notre fork d'[OpenWhispr/openwhispr](https://github.com/OpenWhispr/openwhispr) (dernière fusion : v1.10.2, octobre 2026), orienté **local-first / BYOK / self-hosted**. Les spécificités par rapport à l'amont sont listées plus bas ([Changements Phenisys](#changements-phenisys-fork)). La section *Features* ci-dessous décrit l'application officielle : tout ce qui y concerne le compte, le cloud ou les équipes n'existe pas dans ce fork.

<p align="center">
  <a href="https://openwhispr.com">Website</a> &middot;
  <a href="https://docs.openwhispr.com">Docs</a> &middot;
  <a href="https://github.com/OpenWhispr/openwhispr/releases/latest">Download</a> &middot;
  <a href="https://docs.openwhispr.com/api/overview">API</a> &middot;
  <a href="https://github.com/OpenWhispr/openwhispr/blob/main/CHANGELOG.md">Changelog</a>
</p>

---

OpenWhispr turns your voice into text, notes, and actions from your desktop. Press a hotkey, speak, and your words appear at your cursor. Choose between fully private offline transcription with local speech-to-text models like Orukeet, Whisper, NVIDIA Parakeet, and Cohere Transcribe — where your audio never leaves your device — or cloud processing for speed. No data collection, no telemetry, fully open source.

## Download

| Platform              | Download                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS (Apple Silicon) | [`.dmg`](https://github.com/OpenWhispr/openwhispr/releases/latest)                                                                                                                                                                                                                        |
| macOS (Intel) \*      | [`.dmg`](https://github.com/OpenWhispr/openwhispr/releases/latest)                                                                                                                                                                                                                        |
| Windows               | [`.exe`](https://github.com/OpenWhispr/openwhispr/releases/latest)                                                                                                                                                                                                                        |
| Linux                 | [`.AppImage`](https://github.com/OpenWhispr/openwhispr/releases/latest) / [`.deb`](https://github.com/OpenWhispr/openwhispr/releases/latest) / [`.rpm`](https://github.com/OpenWhispr/openwhispr/releases/latest) / [`.tar.gz`](https://github.com/OpenWhispr/openwhispr/releases/latest) |

\* On Intel Macs, live speaker identification and voice fingerprinting are unavailable: they depend on ONNX Runtime, which [stopped shipping macOS x86_64 binaries in 1.24](https://github.com/microsoft/onnxruntime/releases/tag/v1.24.1). Meetings still record and transcribe normally, and notes search falls back to keyword matching instead of semantic search.

## Features

- **Voice dictation** — global hotkey to dictate into any app with automatic pasting
- **Dictation translation** — dedicated hotkey to dictate in one language and paste the text in another
- **AI agent** — talk to GPT-5, Claude, Gemini, Groq, Tinfoil, OpenRouter, or local models with a named voice assistant
- **Voice Assistant hotkey** — dedicated hotkey that sends what you say straight to your AI assistant as a command, no wake word needed and no cleanup pass; highlighted text is edited in place. With auto-paste enabled, answers paste at a focused text cursor or stream into a floating panel and copy to the clipboard when no writable cursor is available. You can also opt in to sending a screenshot of your current screen as context
- **Meeting transcription** — auto-detect Zoom, Teams, and FaceTime calls with live speaker diarization, voice fingerprinting, and Google, Microsoft, or Apple Calendar integration
- **Local speaker diarization** — on-device speaker labelling with voice fingerprint recognition across meetings, no cloud required
- **Notes** — create, organize, and search notes with folders, semantic search, cloud sync, and AI actions
- **Team spaces & sharing** — free for signed-in users; share notes on the web with link, domain, or invite-only visibility, and collaborate in team spaces with roles, invitations, and server-enforced membership
- **Audio import** — transcribe existing audio and video: drag in files, batch-upload, or paste a YouTube/audio URL, with optional speaker detection
- **Local or cloud — your choice** — all core features (transcription, AI reasoning, speaker diarization, semantic search) work with local models or cloud providers — including GPU-accelerated local Whisper on Metal, CUDA, and Vulkan (AMD/Intel)
- **Enterprise controls** — enforce organization policy, company SSO and SCIM, and centrally managed Amazon Bedrock or Azure OpenAI access without distributing cloud keys
- **Public API & MCP** — manage notes and transcriptions programmatically or connect your AI assistant via the [MCP server](https://docs.openwhispr.com/integrations/mcp)

## Quick start

```bash
git clone https://github.com/OpenWhispr/openwhispr.git
cd openwhispr
npm install
npm run dev
```

Requires Node.js 24+. See the [full documentation](https://docs.openwhispr.com/quickstart) for setup guides, platform-specific instructions, and build details.

## Documentation

Visit **[docs.openwhispr.com](https://docs.openwhispr.com)** for:

- [Getting started](https://docs.openwhispr.com/quickstart)
- [Platform guides](https://docs.openwhispr.com/platform/macos) (macOS, Windows, Linux)
- [API reference](https://docs.openwhispr.com/api/overview)
- [MCP server setup](https://docs.openwhispr.com/integrations/mcp)
- [Troubleshooting](https://docs.openwhispr.com/troubleshooting)

Repo examples:

- [Custom ASR shim](examples/custom-asr-shim/) for Self-Hosted transcription against non-OpenAI-compatible ASR APIs

## Tech stack

React 19, TypeScript, Tailwind CSS v4, Electron 41, better-sqlite3, whisper.cpp, sherpa-onnx, shadcn/ui

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=OpenWhispr/openwhispr&type=date&legend=top-left)](https://www.star-history.com/#OpenWhispr/openwhispr&type=date&legend=top-left)

## Sponsors

<p align="center">
  <a href="https://console.neon.tech/app/?promo=openwhispr">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://neon.com/brand/neon-logo-dark-color.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://neon.com/brand/neon-logo-light-color.svg">
      <img width="250" alt="Neon" src="https://neon.com/brand/neon-logo-light-color.svg">
    </picture>
  </a>
</p>

<p align="center"><a href="https://console.neon.tech/app/?promo=openwhispr">Neon</a> is the serverless Postgres platform powering OpenWhispr Cloud.</p>

## Changements Phenisys (fork)

Politique : **local-first / BYOK / self-hosted**. Règle de fusion :
**intégrer d'abord tout l'amont, puis ré-appliquer nos spécificités** — mode
opératoire et manifeste dans [`docs/upstream-merge/`](docs/upstream-merge/README.md)
(`exclusions.txt` = 117 chemins purgés + 69 exclus ; `parity-checks.txt` = contrat
des fonctionnalités qui doivent survivre).

### 1. Couche compte / cloud / entreprise — retirée

Tout ce qui suppose un serveur OpenWhispr a été purgé (223 fichiers supprimés
par rapport à l'amont v1.10.2) :

- **Compte / login / workspace / équipes / members** — auth, invitations, rôles,
  partage web de notes, API d'espaces (`src/services/*Service.ts`, hooks `useAuth`
  / `useWorkspace`, `src/lib/auth*.ts`, `main.js` nettoyé de 325 lignes).
- **Sync cloud** — `SyncService`, garde-fous de sync, `cloudApi.ts`.
- **Billing / abonnement / upsell** — `WorkspaceBilling*`, `UpgradePrompt`,
  `ReferralDashboard`, `subscriptionFlag`.
- **Microsoft Calendar** — `microsoftCalendarManager`, OAuth Microsoft.
  **Conservé** : agenda **Google** et **Apple** (et le flow OAuth loopback
  partagé dont ils dépendent).
- **Enterprise (gestion centralisée)** — identity store, console, checkout.
  **Conservé** : `enterpriseAiProviders.js` — l'accès BYOK aux endpoints gérés
  **Bedrock / Azure OpenAI / Vertex** n'a rien de « compte » : les clés restent
  chez l'utilisateur.
- **Télémétrie** — retirée (aucune référence restante) ; valeurs résiduelles du
  mode cloud (`"openwhispr"`) basculent en BYOK à la lecture.
- **Leaderboard social / referral / insights-télémétrie** — exclus (classement
  de l'audit de parité v1.10.2).

### 2. Fonctionnalités ajoutées ou modifiées

| Changement | Détail |
|---|---|
| **Arborescence de notes locale** — `src/components/notes/LocalNotesTree.tsx` | Équivalent local de `SpacesTree` (exclu) : l'arborescence de dossiers sans couche espaces/équipes. ⚠️ Les actions du menu d'actions des notes (suppression, renommage) et du panneau (`NewNoteMenu` → bouton simple) vivent encore dans le `SpacesTree` amont exclu : **à porter** (suivi `docs/upstream-merge/parity-checks.txt`). |
| **Transcription des réunions — défaut local** | `meetingTranscriptionMode` défaut sur `local` ; le mode « openwhispr cloud » n'est proposé que pour les réunions (pas de cloud), le routage `meetingTranscriptionRouting` envoie le fournisseur choisi ; tests `settingsStoreMeetingTranscriptionDefault` + routage. |
| **Upload audio — mode self-hosted** | `UploadAudioView` expose explicitement le mode self-hosted (URL + clé) pour la transcription de fichiers. |
| **Inférence par « scope »** | `src/config/inferenceScopes.ts` : timeouts, max tokens et tentatives de retry **configurables par scope** (dictation, agent, transcription…) ; zéro toléré = pas de fallback. |
| **Prompts de système éditables** | Les 6 prompts fixes deviennent éditables dans `PromptStudio` (override persistée, réinitialisable) ; un prompt système vide n'envoie plus de prompt au modèle. |
| **Onboarding sans compte** | Parcours local (permissions, configuration BYOK / local) ; captures dans `docs/screenshots/pr-13/`. |
| **Marque Phenisys** | Logo + icônes ré-émis (dégradé bordeaux-orange) ; thème UI ramené aux couleurs **par défaut de l'amont** (la palette bordeaux de l'UI a été retirée). |
| **Correctifs** | Réparation du dossier des notes ; séparation des intervenants dans les transcriptions (`PersonalNotesView`) ; build tolérant à l'absence des polices de marque privées ; modules du main-process et import analytics rétablis après purges. |

### 3. Distribution & CI (fork)

- **Feuille de mise à jour du fork** : `resources/update-feed.json`
  (`Phenisys/openwhispr`) — le bouton de mise à jour pointe sur **notre**
  dépôt sur toutes les plateformes (`electron-builder.json` l'y inclut).
- **Signatures** : `electron-builder.unsigned.json` + option
  `signing` dans la CI ; le workflow **Release Interne**
  (`.github/workflows/release-interne.yml`) build unsigned sans secrets
  (ad-hoc macOS / non-signé Windows), avec version interne optionnelle.
- **Dépendances** : lockfile aligné sur la résolution amont ; avis npm
  `high` corrigés (CI).
- **i18n** : nouvelles clés (`LocalNotesTree`, boutons) traduites dans les
  11 locales ; les `locales/*` sont ré-écrivables à chaque fusion (conflit
  mécanique attendu, manifeste `exclusions.txt`).
- **Outillage de fusion** : `scripts/upstream-merge.sh` + `upstream_merge_resolve.py`
  (résolution mécanique du manifeste, garde-fou de démarrage),
  `scripts/upstream-parity-audit.mjs` (porte de parité déterministe, exit 1 =
  arbitrage humain), rapports d'arbitrage dans `docs/upstream-merge/`.

## Contributing

We welcome contributions. Fork the repo, create a feature branch, and open a pull request. See the [contributing guide](https://docs.openwhispr.com/contributing) for development setup and guidelines.

## License

[MIT](LICENSE) — free for personal and commercial use.

## Acknowledgments

- **[OpenAI Whisper](https://github.com/openai/whisper)** — speech recognition model powering local and cloud transcription
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** — high-performance C++ implementation for local processing
- **[NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)** — fast multilingual ASR model
- **[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)** — cross-platform ONNX runtime for Parakeet inference
- **[Hugging Face](https://huggingface.co/)** — model hub hosting Whisper, Parakeet, and embedding model weights
- **[llama.cpp](https://github.com/ggerganov/llama.cpp)** — local LLM inference for AI text processing
- **[Electron](https://www.electronjs.org/)** — cross-platform desktop framework
- **[React](https://react.dev/)** — UI component library
- **[shadcn/ui](https://ui.shadcn.com/)** — accessible components built on Radix primitives
- **[Neon](https://console.neon.tech/app/?promo=openwhispr)** — serverless Postgres powering OpenWhispr Cloud
