# Parité fonctionnelle avec l'amont v1.10.2

Comparaison : `HEAD` (notre arbre) ← `refs/tmp/upstream-v1.10.2` (OpenWhispr officiel).

Règle : **intégrer d'abord toutes les fonctionnalités officielles, puis nos spécificités** (BYOK / local / self-hosted). Un chemin exclu par `docs/upstream-merge/exclusions.txt` ne justifie pas de perdre une fonctionnalité non-cloud qu'il portait.

**Verdict : ❌ 5 point(s) à arbitrer**

## À arbitrer

- fichier amont non classé : test/components/spacesTreeNoteActionClearance.test.js
- fichier amont non classé : test/helpers/settingsStoreRetiredGroqModels.test.js
- fonctionnalité manquante : notes-note-delete-action
- fonctionnalité manquante : control-panel-new-note-menu
- fonctionnalité manquante : notes-folder-rename

## 1. Fichiers officiels absents de notre arbre

| Total | Exclus par le manifeste | **Non classés (à tranche)** |
|---|---|---|
| 223 | 221 | **2** |

Chemins présents dans l'amont et ni purgés ni exclus : soit on les porte, soit on les ajoute au manifeste avec une raison.

- `test/components/spacesTreeNoteActionClearance.test.js`
- `test/helpers/settingsStoreRetiredGroqModels.test.js`

<details><summary>Fichiers de notre arbre absents de l'amont (21)</summary>

- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/pull_request_template.md`
- `.github/workflows/release-interne.yml`
- `docs/screenshots/pr-13/onboarding-permissions-clair.png`
- `docs/screenshots/pr-13/onboarding-permissions-sombre.png`
- `docs/upstream-merge/README.md`
- `docs/upstream-merge/arbitrage-v1.10.0.md`
- `docs/upstream-merge/arbitrage-v1.10.2.md`
- `docs/upstream-merge/exclusions.txt`
- `electron-builder.unsigned.json`
- `resources/update-feed.json`
- `scripts/upstream-merge.sh`
- `scripts/upstream_merge_resolve.py`
- `src/components/notes/LocalNotesTree.tsx`
- `test/config/electronBuilderUpdateFeed.test.js`
- `test/config/inferenceAdvancedParams.test.js`
- `test/config/inferenceTimeouts.test.js`
- `test/config/promptsRegistry.test.js`
- `test/config/selfHostedUpload.test.js`
- `test/helpers/settingsStoreMeetingTranscriptionDefault.test.js`
- `test/integrity/moduleResolution.test.js`

</details>

## 2. Fichiers communs où l'amont a des lignes que nous n'avons pas

Fichiers communs divergents : **116**, dont **100** contiennent des lignes amont absentes chez nous.
La colonne « non-cloud » compte les lignes qui ne ressemblent PAS à la couche exclue : ce sont les candidates à la perte silencieuse de fonctionnalité.

| Lignes amont absentes (non-cloud) | Lignes amont absentes (total) | Fichier |
|---|---|---|
| 1004 | 1555 | `src/components/SettingsPage.tsx` |
| 246 | 360 | `main.js` |
| 191 | 288 | `src/helpers/ipcHandlers.js` |
| 147 | 221 | `src/stores/settingsStore.ts` |
| 144 | 260 | `src/components/ControlPanel.tsx` |
| 132 | 219 | `src/components/notes/NoteEditor.tsx` |
| 124 | 158 | `src/components/IntegrationsView.tsx` |
| 113 | 154 | `src/components/ControlPanelSidebar.tsx` |
| 112 | 224 | `src/components/notes/UploadAudioView.tsx` |
| 102 | 160 | `src/types/electron.ts` |
| 95 | 104 | `src/services/ai/inferenceProviders/openai.ts` |
| 91 | 112 | `src/services/ReasoningService.ts` |
| 85 | 126 | `src/components/settings/InferenceConfigEditor.tsx` |
| 83 | 93 | `test/helpers/tinfoilDefaultModel.test.js` |
| 82 | 140 | `test/helpers/transcriptionRoute.test.js` |
| 80 | 146 | `src/helpers/audioManager.js` |
| 72 | 100 | `test/helpers/audioManagerWakeWordLanguage.test.js` |
| 69 | 127 | `src/components/OnboardingFlow.tsx` |
| 61 | 65 | `src/services/ai/inferenceProviders/gemini.ts` |
| 57 | 76 | `test/helpers/audioManagerCancelLifecycle.test.js` |
| 56 | 103 | `src/stores/noteStore.ts` |
| 45 | 56 | `test/helpers/meetingTranscriptionRouting.test.js` |
| 43 | 74 | `src/AppRouter.jsx` |
| 43 | 62 | `test/helpers/dictationTranslationInference.test.js` |
| 42 | 42 | `package-lock.json` |
| 36 | 62 | `test/components/directionalContentPolicy.test.js` |
| 36 | 41 | `test/helpers/useChatStreamingCancellation.test.js` |
| 34 | 38 | `src/models/modelRegistryData.json` |
| 32 | 70 | `src/helpers/transcriptionRoute.ts` |
| 26 | 68 | `src/components/notes/PersonalNotesView.tsx` |
| 21 | 50 | `src/services/tools/searchNotesTool.ts` |
| 21 | 42 | `src/components/SettingsModal.tsx` |
| 21 | 23 | `test/helpers/harness/browserGlobals.js` |
| 20 | 44 | `preload.js` |
| 20 | 43 | `src/services/fileTranscription.ts` |
| 19 | 20 | `src/services/ai/inferenceProviders/tinfoil.ts` |
| 18 | 32 | `src/components/settings/UploadSettings.tsx` |
| 18 | 25 | `src/components/notes/overview/OverviewNoteList.tsx` |
| 18 | 24 | `src/components/onboarding/CalendarConnectionsStep.tsx` |
| 18 | 18 | `src/stores/actionProcessingStore.ts` |

<details><summary>Lignes non-cloud à relire (fichiers du domaine notes/réunions/panneau)</summary>

### `src/components/ControlPanel.tsx`

```diff
+ import { Download, RefreshCw, Loader2, AlertTriangle, Zap } from "./icons";
+ import PostMigrationOnboarding from "./PostMigrationOnboarding";
+ import { decideUpsell } from "../lib/upsell";
+ import NewNoteMenu from "./notes/NewNoteMenu";
+ import { useCreateNote } from "../hooks/useCreateNote";
+ import { fetchProviders as fetchStreamingProviders } from "../stores/streamingProvidersStore";
+ import {
+ const [showPostMigration, setShowPostMigration] = useState(false);
+ const [limitData, setLimitData] = useState<{ wordsUsed: number; limit: number } | null>(null);
+ } | null>(null);
+ const {
+ joinable,
+ dismiss: dismissJoinable,
+ markRequested,
+ null
+ );
+ const upsell = decideUpsell({
+ authLoaded,
+ });
+ useEffect(() => {
+ if (platform !== "darwin") return;
+ window.electronAPI?.getPostMigrationState?.().then((state) => {
+ if (state?.justMigrated) setShowPostMigration(true);
+ });
+ }, []);
+ await window.electronAPI?.markBundleMigrated?.();
+ setShowPostMigration(false);
+ }, []);
+ useEffect(() => {
+ const dispose = window.electronAPI?.onLimitReached?.(
+ (data: { wordsUsed: number; limit: number }) => {
+ setLimitData(data);
+ } else {
+ toast({
+ title: t("controlPanel.limit.weeklyTitle"),
+ description: t("controlPanel.limit.weeklyDescription"),
+ duration: 5000,
+ });
+ }
+ }
+ );
+ return () => {
+ dispose?.();
+ };
+ }, [toast, t]);
+ useEffect(() => {
+ if (sessionStorage.getItem("pastDueNotified")) return;
+ sessionStorage.setItem("pastDueNotified", "true");
+ toast({
+ variant: "destructive",
+ duration: 8000,
+ });
+ useEffect(() => {
+ // Consume the main-process stash so a handled push isn't re-pulled on a
+ // later remount.
+ });
+ });
+ return () => unsubscribe?.();
+ }, []);
+ useEffect(() => {
```

### `src/components/notes/NoteEditor.tsx`

```diff
+ Link2,
+ Lock,
+ Users,
+ import {
+ canOrganizeNote,
+ noteCapabilities,
+ type NoteAclState,
+ import {
+ useNoteConflict,
+ clearNoteConflict,
+ navigateToContainer,
+ updateNoteInStore,
+ } from "../../stores/noteStore";
+ import { NoteSharingService } from "../../services/NoteSharingService";
+ import {
+ SPLIT_BUTTON_DIVIDER_CLASS,
+ SPLIT_BUTTON_GROUP_CLASS,
+ SPLIT_BUTTON_SEGMENT_CLASS,
+ } from "../ui/splitButton";
+ const [membersDialogOpen, setMembersDialogOpen] = useState(false);
+ const [aclRetryVersion, setAclRetryVersion] = useState(0);
+ const [aclRequest, setAclRequest] = useState<{
+ state: Extract<NoteAclState, "loading" | "unavailable">;
+ } | null>(null);
+ );
+ // Persisted flag is the restart-safe truth; the live cache overlays it for
+ // the current session (it reflects server state before the flag persists).
+ ? "loaded"
+ ? "unavailable"
+ ? aclRequest.state
+ : "loading";
+ aclState,
+ locallyOwned: ownsNote(note, user?.id),
+ });
+ });
+ useEffect(() => {
+ let cancelled = false;
+ .then((res) => {
+ if (cancelled) return;
+ access: res.access ?? entry?.access,
+ rawToken: entry?.rawToken ?? null,
+ }));
+ note.id,
+ }
+ })
+ .catch((err) => {
+ if (cancelled) return;
+ });
+ return () => {
+ cancelled = true;
+ };
+ useEffect(() => {
+ if (
+ aclRequest.state !== "unavailable"
+ ) {
+ return;
+ }
+ const retryWhenOnline = () => setAclRetryVersion((version) => version + 1);
+ window.addEventListener("online", retryWhenOnline);
+ return () => window.removeEventListener("online", retryWhenOnline);
```

### `src/components/ControlPanelSidebar.tsx`

```diff
+ import React, { useState } from "react";
+ import {
+ Gift,
+ Lock,
+ Settings,
+ ShieldCheck,
+ HelpCircle,
+ UserCircle,
+ UserPlus,
+ X,
+ Zap,
+ } from "./icons";
+ import logoIcon from "../assets/icon.png";
+ import { Button } from "./ui/button";
+ import type { UpsellDecision } from "../lib/upsell";
+ isOverLimit?: boolean;
+ userName?: string | null;
+ userEmail?: string | null;
+ userImage?: string | null;
+ authLoaded?: boolean;
+ upsell: UpsellDecision;
+ isOverLimit,
+ userName,
+ userEmail,
+ userImage,
+ authLoaded,
+ upsell,
+ );
+ {showLimitBanner && (
+ <div className="px-2 pb-2">
+ <div className="rounded-lg border border-destructive/25 bg-destructive/5 dark:bg-destructive/10 p-3">
+ <div className="flex flex-col items-center text-center">
+ <img src={logoIcon} alt="" className="w-7 h-7 rounded-md mb-2" />
+ <p className="text-xs font-medium text-foreground mb-0.5">
+ {t("sidebar.limitReached")}
+ </p>
+ <p className="text-[11px] leading-snug text-muted-foreground mb-2.5">
+ {t("sidebar.limitReachedDescription")}
+ </p>
+ {t("sidebar.viewPlans")}
+ </Button>
+ </div>
+ </div>
+ </div>
+ )}
+ <div className="px-2 pb-2">
+ <div className="relative rounded-xl border border-[#6c50e9]/25 dark:border-[#6c50e9]/40 bg-card bg-gradient-to-b from-[#6c50e9]/15 via-[#6c50e9]/5 to-transparent dark:from-[#6c50e9]/30 dark:via-[#6c50e9]/10 p-3">
+ <button
+ onClick={() => {
+ }}
+ aria-label={t("common.dismiss")}
+ className="absolute top-2 end-2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
+ >
+ <X size={12} />
+ </button>
+ <img src={logoIcon} alt="" className="w-7 h-7 rounded-md mb-2.5" />
+ <p className="text-[13px] font-semibold text-foreground mb-0.5">
+ </p>
+ <p className="text-xs leading-snug text-muted-foreground mb-2.5">
+ </p>
```

### `src/components/notes/UploadAudioView.tsx`

```diff
+ import { useStartOnboarding } from "../../hooks/useStartOnboarding";
+ // The server enforces the free-tier size limit regardless, so an unresolved
+ const setUploadTranscriptionMode = useSettingsStore((s) => s.setUploadTranscriptionMode);
+ );
+ const setUploadUseLocalWhisper = useSettingsStore((s) => s.setUploadUseLocalWhisper);
+ );
+ // Mode detection
+ // Mode-aware file size validation
+ // Local: no limits at all
+ let fileTooLarge = false;
+ let byokTooLarge = false;
+ let isLargeFile = false;
+ if (file) {
+ if (useLocalWhisper) {
+ // Local transcription: no file size restrictions
+ // Self-hosted / custom endpoints (e.g. local whisper.cpp): no file size restrictions
+ } else if (isByok) {
+ byokTooLarge = file.sizeBytes > byokMaxFileSize;
+ }
+ } else {
+ }
+ }
+ setProviderReady(true);
+ return;
+ }
+ setProviderReady(true);
+ return;
+ }
+ if (isByok) return sizeBytes > byokMaxFileSize ? "byokTooLarge" : null;
+ return null;
+ window.electronAPI.cancelUploadTranscription?.(activeRequestIdRef.current);
+ if (
+ !isTranscriptionContextAllowed(usePolicyStore.getState(), getSettings(), "upload")
+ ) {
+ if (useChunkProgress) {
+ progressCleanupRef.current =
+ window.electronAPI.onUploadTranscriptionProgress?.((data) => {
+ if (data.chunksTotal > 0) {
+ setChunkProgress({
+ chunksTotal: data.chunksTotal,
+ chunksCompleted: data.chunksCompleted,
+ });
+ setProgress((data.chunksCompleted / data.chunksTotal) * 90);
+ }
+ }) ?? null;
+ } else {
+ progressRef.current = setInterval(() => {
+ setProgress((prev) => {
+ if (prev >= 90) {
+ if (progressRef.current) clearInterval(progressRef.current);
+ return prev;
+ }
+ return prev + Math.random() * 6;
+ });
+ }, 500);
+ }
+ if (
+ !isTranscriptionContextAllowed(usePolicyStore.getState(), getSettings(), "upload")
+ ) {
+ setUploadTranscriptionMode("openwhispr");
```

### `src/stores/noteStore.ts`

```diff
+ // teardown that clears it via setState stops the fast pull too.
+ useNoteStore.subscribe((state) => {
+ });
+ let migrationGeneration = 0;
+ }
+ // not at the next ambient pass ("manual" bypasses the throttle).
+ migrationGeneration += 1;
+ export function useMigration(): { total: number; done: number } | null {
+ return useNoteStore((state) => state.migration);
+ }
+ const gen = ++migrationGeneration;
+ const allNotes = (await window.electronAPI.getNotes(null, 9999, null)) ?? [];
+ if (gen !== migrationGeneration) return;
+ const { NotesService } = await import("../services/NotesService.js");
+ const CHUNK_SIZE = 50;
+ if (gen !== migrationGeneration) return;
+ try {
+ const { created } = await NotesService.batchCreate(
+ chunk.map((n) => ({
+ client_note_id: n.client_note_id,
+ title: n.title,
+ content: n.content,
+ enhanced_content: n.enhanced_content,
+ enhancement_prompt: n.enhancement_prompt,
+ note_type: n.note_type,
+ source_file: n.source_file,
+ audio_duration_seconds: n.audio_duration_seconds,
+ created_at: n.created_at,
+ updated_at: n.updated_at,
+ }))
+ );
+ // A reset may invalidate the UI migration while the POST is in flight.
+ // Still run every response through the atomic identity/snapshot guard so
+ chunk,
+ created,
+ // Migration POSTs intentionally omit transcript/diarization fields,
+ {
+ settleIfUnchanged: false,
+ // Starting a newer migration supersedes only this run's progress.
+ }
+ );
+ if (gen !== migrationGeneration) return;
+ useNoteStore.setState((s) => ({
+ migration: s.migration
+ ? {
+ total: s.migration.total,
+ done: Math.min(s.migration.done + chunk.length, s.migration.total),
+ }
+ : null,
+ }));
+ } catch (err) {
+ console.error("Migration chunk failed:", err);
+ }
+ }
+ if (gen === migrationGeneration) useNoteStore.setState({ migration: null });
+ }
```

### `test/helpers/meetingTranscriptionRouting.test.js`

```diff
+ {
+ id: "assemblyai",
+ models: [{ id: "universal-streaming", default: true }],
+ },
+ ],
+ const { resolveMeetingTranscriptionOptions } = await load();
+ assert.deepEqual(
+ resolveMeetingTranscriptionOptions({
+ ...baseOptions,
+ transcriptionMode: "openwhispr",
+ }),
+ {
+ provider: "assemblyai-realtime",
+ model: "universal-streaming",
+ mode: "openwhispr",
+ language: "en",
+ }
+ );
+ });
+ const { resolveMeetingTranscriptionOptions } = await load();
+ assert.deepEqual(
+ resolveMeetingTranscriptionOptions({
+ ...baseOptions,
+ transcriptionMode: "openwhispr",
+ }),
+ {
+ provider: "openai-realtime",
+ model: "gpt-4o-mini-transcribe",
+ mode: "openwhispr",
+ language: "en",
+ }
+ );
+ });
+ null,
+ [{ id: "openai", models: [{ id: "gpt-4o-mini-transcribe", default: true }] }],
+ ];
+ assert.equal(
+ resolveMeetingTranscriptionOptions({
+ ...baseOptions,
+ transcriptionMode: "openwhispr",
+ selectedModel: "gpt-live-transcribe",
+ }).model,
+ "gpt-4o-mini-transcribe"
+ );
+ }
```

### `src/components/notes/PersonalNotesView.tsx`

```diff
+ if (
+ structureIntroPending &&
+ isOnboardingComplete &&
+ !isTreeLoading &&
+ !isSidePanelLayout
+ ) {
+ }, [
+ structureIntroPending,
+ isOnboardingComplete,
+ isTreeLoading,
+ isSidePanelLayout,
+ ]);
+ // this device has already seen it, and even before notes onboarding is done
+ // (the dialog also renders in the onboarding branch below).
+ useEffect(() => {
+ // hidden behind Personal.
+ useEffect(() => {
+ // may enumerate no grants at all. In that case, open the first accessible
+ (anyGrant ||
+ );
+ setActiveNoteId(null);
+ selfName: user?.name?.trim() || null,
+ selfEmail: user?.email?.trim() || null,
+ onDeleteNote={handleDelete}
+ onMoveNote={handleMoveNote}
+ onCreateFolderAndMove={handleCreateFolderAndMove}
```

### `src/services/tools/searchNotesTool.ts`

```diff
+ // searches go straight to the local legs. Folder scoping is local-only:
+ }
+ query: string,
+ limit: number,
+ ): Promise<ToolResult> {
+ const { NotesService } = await import("../../services/NotesService.js");
+ );
+ const results = await Promise.all(
+ id: await resolveLocalNoteId(cn.client_note_id),
+ title: cn.title,
+ date: cn.created_at,
+ type: cn.note_type,
+ score: cn.score,
+ content: (cn.enhanced_content || cn.content).slice(0, MAX_CONTENT_LENGTH),
+ }))
+ );
+ return {
+ success: true,
+ data: results,
+ };
+ }
```

### `src/components/notes/overview/OverviewNoteList.tsx`

```diff
+ import MemberAvatar from "../../MemberAvatar";
+ const isSelf = authorId != null && authorId === user?.id;
+ const authorName = isSelf
+ ? t("notes.overview.author.you")
+ : (member?.name ?? member?.email ?? null);
+ {authorName && (
+ <span className="flex items-center gap-1.5 shrink-0">
+ <MemberAvatar
+ name={member?.name ?? authorName}
+ email={member?.email ?? ""}
+ image={member?.image}
+ size="sm"
+ />
+ <span className="text-[11px] text-foreground/45 max-w-28 truncate">
+ {authorName}
+ </span>
+ </span>
+ )}
```

### `src/hooks/useNotesOnboarding.ts`

```diff
+ import { useShallow } from "zustand/react/shallow";
+ import {
+ selectPolicyEffectiveSettings,
+ useSettingsStore,
+ } from "../stores/settingsStore";
+ import { usePolicySnapshot } from "./usePolicy";
+ const policyState = usePolicySnapshot();
+ useShallow((settings) => {
+ const effective = selectPolicyEffectiveSettings(settings, policyState);
+ return {
+ useCleanupModel: effective.useCleanupModel,
+ effectiveModel: effective.cleanupModel,
+ };
+ })
+ );
```

### `test/helpers/settingsStoreMeetingFollowFlags.test.js`

```diff
+ [{ reasoningProvider: "llama" }, "openwhispr"],
+ assert.equal(state.meetingTranscriptionMode, "openwhispr");
+ assert.equal(state.noteFormattingMode, "openwhispr");
+ assert.equal(state.meetingTranscriptionMode, "openwhispr");
+ assert.equal(state.meetingTranscriptionMode, "openwhispr", "reconstructed, not localized");
+ assert.equal(state.noteFormattingMode, "openwhispr");
+ assert.equal(state.cleanupMode, "openwhispr", "dictation cleanup untouched");
+ // processText treats an override carrying no provider as implicit cleanup
+ // and dispatches from the cleanup scope, which is local.
+ assert.equal(overrides.provider, undefined, "no pin, so no anthropic dispatch");
+ assert.equal(state.transcriptionMode, "openwhispr", "dictation untouched");
+ for (const mode of ["openwhispr", "providers", "local"]) {
+ assert.equal(state.noteFormattingMode, "openwhispr", "store default, not derived");
```

### `src/components/settings/MeetingSettings.tsx`

```diff
+ import { useStartOnboarding } from "../../hooks/useStartOnboarding";
+ const startOnboarding = useStartOnboarding();
+ {
+ id: "openwhispr",
+ label: t("settingsPage.transcription.modes.openwhispr"),
+ description: t("settingsPage.transcription.modes.openwhisprDesc"),
+ },
+ if (mode === "self-hosted") return;
+ startOnboarding();
+ return;
+ }
```

### `src/components/notes/overview/ContainerOverview.tsx`

```diff
+ import { Plus, UserPlus } from "../../icons";
+ : undefined;
+ <button
+ className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md border border-border/70 dark:border-white/10 text-xs font-medium text-foreground/60 hover:text-foreground/85 hover:border-border/70 hover:bg-foreground/3 dark:hover:bg-white/3 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
+ >
+ <UserPlus size={12} />
+ </button>
+ )}
+ />
+ )}
```

### `src/helpers/meetingTranscriptionRouting.js`

```diff
+ if (transcriptionMode === "openwhispr") {
+ return {
+ provider: `${provider.id}-realtime`,
+ model: resolveModel(provider, selectedModel),
+ mode: "openwhispr",
+ language,
+ };
+ }
```

### `src/hooks/useAudioRecording.js`

```diff
+ !isTranscriptionContextAllowed(policyState, getSettings(), "dictation")) ||
```

### `src/stores/meetingRecordingStore.ts`

```diff
+ import { useStreamingProvidersStore } from "./streamingProvidersStore";
```

### `test/stores/meetingRecordingStoreSystemAudioInterrupted.test.js`

```diff
+ await Promise.all([mainStarted.promise, micRequested.promise]);
```

</details>

## 3. Clés d'interface utilisées par l'amont et plus nulle part chez nous

826 clés. Les namespaces de la couche exclue (auth, workspaces, insights, referral, apiKeysSection, forgotPassword, emailVerification, WorkspaceSection, billing, onboarding, settingsPage, sidebar) sont attendus ; tout le reste signale un écran ou une action disparus.

| Namespace | Clés | Attendu (couche exclue) |
|---|---|---|
| `settingsPage` | 302 | oui |
| `notes` | 117 | **non — à vérifier** |
| `insights` | 90 | oui |
| `workspaces` | 53 | oui |
| `referral` | 44 | oui |
| `auth` | 42 | oui |
| `noteEditor` | 40 | **non — à vérifier** |
| `integrations` | 27 | **non — à vérifier** |
| `apiKeysSection` | 24 | oui |
| `sidebar` | 13 | oui |
| `upgradePrompt` | 13 | **non — à vérifier** |
| `forgotPassword` | 12 | oui |
| `common` | 9 | **non — à vérifier** |
| `emailVerification` | 9 | oui |
| `settingsModal` | 7 | **non — à vérifier** |
| `controlPanel` | 6 | **non — à vérifier** |
| `postMigration` | 4 | **non — à vérifier** |
| `onboarding` | 2 | oui |
| `Authorization` | 1 | **non — à vérifier** |
| `OpenWhispr` | 1 | **non — à vérifier** |
| `archived` | 1 | **non — à vérifier** |
| `backfill` | 1 | **non — à vérifier** |
| `callbackURL` | 1 | **non — à vérifier** |
| `cursor` | 1 | **non — à vérifier** |
| `cursor_id` | 1 | **non — à vérifier** |
| `email` | 1 | **non — à vérifier** |
| `include` | 1 | **non — à vérifier** |
| `includeWeekStarts` | 1 | **non — à vérifier** |
| `microsoft` | 1 | **non — à vérifier** |
| `weekStart` | 1 | **non — à vérifier** |

<details><summary>Clés hors couche exclue</summary>

- `Authorization` : `Authorization`
- `OpenWhispr` : `OpenWhispr`
- `archived` : `archived`
- `backfill` : `backfill`
- `callbackURL` : `callbackURL`
- `common` : `common.actions`, `common.add`, `common.copy`, `common.create`, `common.delete`, `common.dismiss`, `common.done`, `common.freeAccountRequired`, `common.saving`
- `controlPanel` : `controlPanel.billing.bannerDescription`, `controlPanel.billing.pastDueDescription`, `controlPanel.billing.pastDueTitle`, `controlPanel.billing.updatePayment`, `controlPanel.limit.weeklyDescription`, `controlPanel.limit.weeklyTitle`
- `cursor` : `cursor`
- `cursor_id` : `cursor_id`
- `email` : `email`
- `include` : `include`
- `includeWeekStarts` : `includeWeekStarts`
- `integrations` : `integrations.api.description`, `integrations.api.dialogTitle`, `integrations.api.manage`, `integrations.api.proRequired`, `integrations.api.title`, `integrations.api.viewPlans`, `integrations.cli.cloud.description`, `integrations.cli.cloud.label`, `integrations.cli.cloud.proRequired`, `integrations.cli.viewPlans`, `integrations.mcp.copied`, `integrations.mcp.copyUrl`, `integrations.mcp.description`, `integrations.mcp.learnMore`, `integrations.mcp.proRequired`, `integrations.mcp.step1`, `integrations.mcp.step2`, `integrations.mcp.step3`, `integrations.mcp.title`, `integrations.mcp.viewPlans`, `integrations.microsoftCalendar.connectFailedDescription`, `integrations.microsoftCalendar.disconnect`, `integrations.microsoftCalendar.disconnectConfirm`, `integrations.microsoftCalendar.disconnectDescription`, `integrations.plan.pro`, `integrations.sections.api`, `integrations.sections.mcp`
- `microsoft` : `microsoft`
- `noteEditor` : `noteEditor.share.button`, `noteEditor.share.dialog.accepted`, `noteEditor.share.dialog.copied`, `noteEditor.share.dialog.copyLink`, `noteEditor.share.dialog.createLink`, `noteEditor.share.dialog.description`, `noteEditor.share.dialog.editor`, `noteEditor.share.dialog.emailLabel`, `noteEditor.share.dialog.error.alreadyInvited`, `noteEditor.share.dialog.error.copyFailed`, `noteEditor.share.dialog.error.invalidEmail`, `noteEditor.share.dialog.error.inviteFailed`, `noteEditor.share.dialog.error.loadFailed`, `noteEditor.share.dialog.error.resendFailed`, `noteEditor.share.dialog.error.retry`, `noteEditor.share.dialog.error.revokeFailed`, `noteEditor.share.dialog.error.syncFailed`, `noteEditor.share.dialog.error.visibilityFailed`, `noteEditor.share.dialog.export`, `noteEditor.share.dialog.invitationActions`, `noteEditor.share.dialog.noResults`, `noteEditor.share.dialog.owner`, `noteEditor.share.dialog.pending`, `noteEditor.share.dialog.resend`, `noteEditor.share.dialog.resendSent`, `noteEditor.share.dialog.resendThrottled`, `noteEditor.share.dialog.revoke`, `noteEditor.share.dialog.searchPlaceholder`, `noteEditor.share.dialog.shareButton`, `noteEditor.share.dialog.syncAndShare`, `noteEditor.share.dialog.syncPrompt`, `noteEditor.share.dialog.teamAudience`, `noteEditor.share.dialog.title`, `noteEditor.share.dialog.viewer`, `noteEditor.share.dialog.visibility.domain`, `noteEditor.share.dialog.visibility.invited`, `noteEditor.share.dialog.visibility.label`, `noteEditor.share.dialog.visibility.link`, `noteEditor.share.dialog.visibility.private`, `noteEditor.share.dialog.visibility.privateOption`
- `notes` : `notes.context.moveToFolder`, `notes.context.rename`, `notes.context.showInFileManager`, `notes.createMenu.assistantChat`, `notes.createMenu.chooseType`, `notes.createMenu.note`, `notes.createMenu.teamSpace`, `notes.folders.couldNotDelete`, `notes.folders.couldNotRename`, `notes.folders.deleteConfirm`, `notes.folders.deleteDescription`, `notes.folders.deleteDescriptionEmpty`, `notes.folders.deleteTitle`, `notes.list.shared`, `notes.list.title`, `notes.overview.author.you`, `notes.overview.invite`, `notes.realtimeBanner.message`, `notes.realtimeBanner.upgrade`, `notes.spaces.accessRevoked`, `notes.spaces.accessRevokedActiveNote`, `notes.spaces.changeEmoji`, `notes.spaces.confirmMoveInTitle`, `notes.spaces.couldNotCreate`, `notes.spaces.couldNotDelete`, `notes.spaces.couldNotLeave`, `notes.spaces.couldNotMove`, `notes.spaces.couldNotMoveNote`, `notes.spaces.create`, `notes.spaces.createDescription`, `notes.spaces.createTitle`, `notes.spaces.created`, `notes.spaces.deleteConfirmTitle`, `notes.spaces.deleteSpace`, `notes.spaces.deleteTypeName`, `notes.spaces.deleted`, `notes.spaces.emptySpace`, `notes.spaces.emptyTeamHint`, `notes.spaces.folderNameTaken`, `notes.spaces.groups.optional`, `notes.spaces.groups.title`, `notes.spaces.invitedTo`, `notes.spaces.invitedToSpaces`, `notes.spaces.leave`, `notes.spaces.leaveConfirmDescription`, `notes.spaces.leaveConfirmTitle`, `notes.spaces.leaveDescription`, `notes.spaces.leaveDirectDescription`, `notes.spaces.leaveKeepsGroupAccess`, `notes.spaces.leaveTitle`, `notes.spaces.left`, `notes.spaces.members.addFailed`, `notes.spaces.members.addPeople`, `notes.spaces.members.addedToTeam`, `notes.spaces.members.empty`, `notes.spaces.members.inviteFooter`, `notes.spaces.members.invited`, `notes.spaces.members.managedByGroup`, `notes.spaces.members.noResults`, `notes.spaces.members.remove`, `notes.spaces.members.removeConfirm`, `notes.spaces.members.removeConfirmDescription`, `notes.spaces.members.removeKeepsGroupAccess`, `notes.spaces.members.removedFromTeam`, `notes.spaces.members.roleFromGroup`, `notes.spaces.members.roleUpdated`, `notes.spaces.members.searchPlaceholder`, `notes.spaces.members.stillViaGroups`, `notes.spaces.members.viaGroup`, `notes.spaces.members.you`, `notes.spaces.moveConfirm`, `notes.spaces.moveTo`, `notes.spaces.moveToSpace`, `notes.spaces.moved`, `notes.spaces.movedToPersonal`, `notes.spaces.nameAndIconLabel`, `notes.spaces.newSpace`, `notes.spaces.newSpaceInWorkspace`, `notes.spaces.noSpacesFound`, `notes.spaces.privateSpaces`, `notes.spaces.privateTooltip`, `notes.spaces.searchSpaces`, `notes.spaces.settings`, `notes.spaces.settingsTitle`, `notes.spaces.spaceRoot`, `notes.spaces.stillViaGroups`, `notes.spaces.teamSpaces`, `notes.spaces.teams.loadError`, `notes.spaces.teams.newTeam`, `notes.spaces.teamsMembers.accessAdmin`, `notes.spaces.teamsMembers.accessChanged`, `notes.spaces.teamsMembers.accessHint`, `notes.spaces.teamsMembers.accessLabel`, `notes.spaces.teamsMembers.accessMember`, `notes.spaces.teamsMembers.addTeamLabel`, `notes.spaces.teamsMembers.chooseTeam`, `notes.spaces.teamsMembers.noTeams`, `notes.spaces.teamsMembers.removeTeamConfirm`, `notes.spaces.teamsMembers.removeTeamConfirmDescription`, `notes.spaces.teamsMembers.removeTeamFromSpace`, `notes.spaces.teamsMembers.teamAdded`, `notes.spaces.teamsMembers.teamRemoved`, `notes.spaces.teamsMembers.title`, `notes.spaces.undo`, `notes.structureIntro.reopen`, `notes.upload.byokTooLargeNeedsAccount`, `notes.upload.byokTooLargeNeedsUpgrade`, `notes.upload.createAccount`, `notes.upload.diarizationRunsLocally`, `notes.upload.fileTooLarge`, `notes.upload.largeFileNote`, `notes.upload.openwhisprCloud`, `notes.upload.paidPlanRequired`, `notes.upload.switchToCloud`, `notes.upload.switchToCloudForLargeFiles`, `notes.upload.transcribingCloud`, `notes.upload.upgrade`
- `postMigration` : `postMigration.description`, `postMigration.done`, `postMigration.remindLater`, `postMigration.title`
- `settingsModal` : `settingsModal.groups.account`, `settingsModal.sections.account.description`, `settingsModal.sections.account.label`, `settingsModal.sections.plansBilling.description`, `settingsModal.sections.plansBilling.label`, `settingsModal.sections.workspace.description`, `settingsModal.sections.workspace.label`
- `upgradePrompt` : `upgradePrompt.limitDescription`, `upgradePrompt.pastDueDescription`, `upgradePrompt.paymentFailed`, `upgradePrompt.rollingWeeklyLimit`, `upgradePrompt.switchToLocal`, `upgradePrompt.switchToLocalDescription`, `upgradePrompt.updatePayment`, `upgradePrompt.updatePaymentDescription`, `upgradePrompt.upgradeDescription`, `upgradePrompt.upgradeToPro`, `upgradePrompt.useApiKey`, `upgradePrompt.useApiKeyDescription`, `upgradePrompt.weeklyLimit`
- `weekStart` : `weekStart`

</details>

## 4. Contrat de parité fonctionnelle

Source : `docs/upstream-merge/parity-checks.txt`.

| État | Fonctionnalité | Aiguille cherchée | Chez nous | Amont |
|---|---|---|---|---|
| MANQUANT | `notes-note-delete-action` | `onDeleteNote` | 0 fichier(s) | 4 fichier(s) |
| OK | `notes-note-delete-ipc` | `db-delete-note` | 1 fichier(s) | 1 fichier(s) |
| OK | `notes-meeting-autoend-controller` | `meetingAutoEndController` | 1 fichier(s) | 1 fichier(s) |
| OK | `notes-meeting-autoend-event` | `onMeetingAutoEndRequested` | 2 fichier(s) | 2 fichier(s) |
| OK | `notes-meeting-autoend-eligibility` | `isMeetingAutoEndEligible` | 5 fichier(s) | 5 fichier(s) |
| OK | `notes-meeting-summary-after-autoend` | `shouldOfferMeetingSummary` | 3 fichier(s) | 3 fichier(s) |
| OK | `meeting-detection-engine` | `meetingDetectionEngine` | 24 fichier(s) | 24 fichier(s) |
| OK | `meeting-recording-pill` | `MeetingRecordingPill` | 5 fichier(s) | 5 fichier(s) |
| OK | `meeting-system-audio-watchdog` | `meetingSystemAudioWatchdog` | 13 fichier(s) | 13 fichier(s) |
| MANQUANT | `control-panel-new-note-menu` | `NewNoteMenu` | 0 fichier(s) | 4 fichier(s) |
| OK | `control-panel-start-recording-for-note` | `startRecordingForNote` | 4 fichier(s) | 4 fichier(s) |
| MANQUANT | `notes-folder-rename` | `startRenameFolder` | 0 fichier(s) | 3 fichier(s) |
| OK | `notes-folder-dialog` | `AddNotesToFolderDialog` | 6 fichier(s) | 6 fichier(s) |
| OK | `notes-editor-record-control` | `NoteRecordControl` | 5 fichier(s) | 5 fichier(s) |

