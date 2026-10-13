# Arbitrage de la fusion v1.10.3 (base amont v1.10.2)

Fusion de `upstream-v1.10.3` (a00123b3) dans le fork. Règle : on garde tout l'amont
(connecteurs, correctifs, tests) sauf la couche exclue (compte / cloud / workspace /
billing / sync / MS-Calendar / enterprise).

## 1. Fichiers exclus modifiés par l'amont (EXCLU-MODIFIÉ)

Diff amont lu pour chacun ; aucune fonctionnalité non-cloud à porter.

| Fichier | Ce que l'amont a changé | Décision |
|---|---|---|
| `src/components/InsightsView.tsx` | skeletons de chargement du dashboard Insights (couche insights/télémétrie exclue) | exclu confirmé, non porté |
| `src/components/LeaderboardPodium.tsx` | refonte UI du leaderboard social (exclu) | exclu confirmé, non porté |
| `src/components/LeaderboardSection.tsx` | skeletons/refonte du leaderboard social (exclu) | exclu confirmé, non porté |
| `src/config/retiredCloudModels.ts` | rotation du sentinel Tinfoil + remap deepseek-v4-flash→v4-1-flash | exclu confirmé, non porté |
| `src/helpers/microsoftCalendarManager.js` | alias/own-address, attendees ressource, tenantId — Microsoft Calendar (exclu) | exclu confirmé, non porté |
| `src/helpers/microsoftCalendarOAuth.js` | tenantId depuis l'id_token — Microsoft Calendar (exclu) | exclu confirmé, non porté |
| `test/components/authenticationStep.test.js` | teste AuthenticationStep (login/Apple sign-in, exclu) | exclu confirmé, non porté |
| `test/components/leaderboardNavigation.test.js` | teste le leaderboard social (exclu) | exclu confirmé, non porté |
| `test/components/leaderboardStates.test.js` | teste le leaderboard social (exclu) | exclu confirmé, non porté |
| `test/helpers/accountOwnershipDatabase.test.js` | teste la propriété de compte (couche compte exclue) | exclu confirmé, non porté |
| `test/helpers/accountScopeIpc.test.js` | teste le scope de compte IPC (exclu) | exclu confirmé, non porté |
| `test/helpers/accountScopeRestoreContract.test.js` | teste le contrat de restore par compte (exclu) | exclu confirmé, non porté |
| `test/helpers/microsoftCalendarManager.test.js` | teste Microsoft Calendar (exclu) | exclu confirmé, non porté |
| `test/helpers/retiredCloudModels.test.js` | teste la table statique retiredCloudModels.ts (exclue) — cf. settingsStoreRetiredGroqModels | exclu confirmé, non porté |

Traçage : section `[excluded-reviewed]` de `exclusions.txt`.

## 2. Conflits de contenu (37 fichiers) et adaptations « mode local »

Principe : version amont comme référence ; on ne retire que la couche exclue, à ses frontières
(`src/components/notes/localMode.ts` côté renderer, `src/helpers/localMode.js` côté process principal).

| Zone | Fichiers | Décision |
|---|---|---|
| Process principal / IPC | `main.js`, `preload.js`, `src/helpers/ipcHandlers.js`, `src/types/electron.ts`, `modelManagerBridge.js` | Amont repris (permission guide, startup-hold, erreurs de transcription classées, connecteurs). Écarté : deep links invitation, serveur auth bridge, OAuth/upgrade, scope de compte actif, `executeManagedTranscription`. Connecteurs câblés en mode local : politique toujours « allowed », scope fixe `local` (`LOCAL_ACCOUNT_SCOPE`). |
| Audio / upload / réunions | `audioManager.js`, `UploadAudioView.tsx`, `UploadSettings.tsx`, `MeetingSettings.tsx` + 2 tests | UI et flux amont repris ; retirés : mode « openwhispr » cloud, `requestSignIn`, quotas/plan, analytics, usage cloud, résolution managée/enterprise. |
| UI Settings / panneau | `SettingsPage.tsx`, `ControlPanel.tsx`, `ControlPanelSidebar.tsx`, `IntegrationsView.tsx`, `AppRouter.jsx`, `CalendarConnectionsStep.tsx` | Correctifs amont portés (hotkeys, Linux PTT, `AssistantNoteUndoListener`, `PermissionGuideOverlay`, `CliPane`). Retirés : onglets compte/plan/workspace, avatar, bannières billing, Microsoft Calendar (y compris dans `CalendarsPane.tsx`), volets API/MCP hébergés (`McpPane.tsx` exclu), `LeaderboardSkeleton`. |
| Services IA / stores | `ReasoningService.ts`, `inferenceProviders/*`, `InferenceConfigEditor.tsx`, `prompts*.ts`, `searchNotesTool.ts`, `actionProcessingStore.ts`, `batchQueueStore.ts`, `useChatStreaming.ts` | Classification d'erreurs fournisseur, prompts de connecteurs, tableaux/modèles de résumé repris ; conservés : nos timeouts / retries / PromptStudio. Recherche cloud et gestion managée retirées. |
| Notes | `NoteEditor.tsx`, `ContainerOverview.tsx`, `NewNoteMenu.tsx`, `noteStore.ts` | Amont repris ; partage/ACL/équipes retirés (`useAuth` → `localMode.ts`), migration cloud retirée. |
| Tests de politique | `fieldDirectionPolicy`, `directionalContentPolicy`, `newNoteMenu`, `connectorTools`, `connectorManager`, `noteTools` | Cartes alignées sur les fichiers présents. Retirés : tests de plan connecteurs (`hasConnectorPlan`), de scope de compte, de recherche cloud. |
| Sync cloud | `noteFieldSync`, `noteCreateReconciliation`, `noteCloudCollision`, `noteCreateConcurrentEdits`, `noteRevisionRecovery` (tests) | Excluent `SyncService` / `fakeCloud` : ajoutés à `[excluded]`. |
| Autres | `useConnectorAccess.ts` | Pas de couche plan : `isPaid: true`, politique d'organisation conservée. `connectorEligibility.ts` exclu. |

Script : `upstream_merge_resolve.py` ignore désormais les spécificateurs en commentaire de ligne.
