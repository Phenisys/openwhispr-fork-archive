// Local-mode surface for the upstream SpacesTree (see docs/upstream-merge/README.md).
// The fork has no account, workspace, team-space or sharing layer, so SpacesTree
// stays byte-for-byte the upstream file and only its imports are redirected here:
// one signed-out, workspace-less, single-user answer for each cloud-backed hook,
// permission helper and dialog. Everything is permitted, nothing is team-scoped.
import type { FolderItem, NoteItem, SpaceItem, Workspace } from "../../types/electron";

export const useAuth = () => ({ isSignedIn: false, user: null as { id: string } | null });
export const useTeamSpacesCapability = (_isSignedIn: boolean) => false;
export const useCanCreateTeamSpace = () => false;
export const useWorkspace = () => ({ workspaces: [] as Workspace[], loaded: true });

export const canChangeSpaceNoteScope = (..._args: unknown[]) => true;
export const canDeleteSpaceNote = (..._args: unknown[]) => true;
export const canManageSpace = (..._args: unknown[]) => true;
export const canManageWorkspace = (..._args: unknown[]) => false;
export const canMoveBetweenSpaces = (_from: SpaceItem, _to: SpaceItem) => false;
export const canMoveOrDeleteSpaceFolder = (..._args: unknown[]) => true;

export const groupTeamSpacesByWorkspace = <S>(_workspaces: Workspace[], _teamSpaces: S[]) => ({
  groups: [] as { workspace: Workspace; spaces: S[] }[],
  ungrouped: [] as S[],
  ordered: [] as S[],
});

// Team/space dialogs are only reachable from team-space UI, which never renders here.
const NoDialog = (_props: Record<string, unknown>) => null;
export const CreateSpaceDialog = NoDialog;
export const SpaceSettingsDialog = NoDialog;
export const DeleteSpaceDialog = NoDialog;

export type { FolderItem, NoteItem };
