import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  ExternalLink,
  FilePlus,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { useToast } from "../ui/useToast";
import { localMutationErrorKey } from "../../lib/localMutationError";
import { getCachedPlatform } from "../../utils/platform";
import {
  createFolder,
  deleteFolder,
  folderContainerKey,
  renameFolder,
  setActiveContext,
  setActiveNoteId,
  spaceContainerKey,
  toggleContainerExpanded,
  useActiveContext,
  useActiveFolderId,
  useActiveNoteId,
  useFolderCounts,
  useFolders,
  useNotesByContainer,
  useSpaces,
} from "../../stores/noteStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { FolderItem, NoteItem } from "../../types/electron";
import { cn } from "../lib/utils";

const FOLDER_INPUT_CLASS =
  "flex h-6 w-full items-center gap-1.5 rounded-md border border-border/40 bg-transparent px-1.5 text-xs text-foreground outline-none focus:border-primary/40";

// Row-end action buttons: 20px square, revealed on hover / menu open, and
// absolute so the truncated label never collides with them (the row carries
// pe-12 clearance when a menu is present). See treeDirection.ts for the
// LTR/RTL clearance math the upstream tree tests against.
const KEBAB_BUTTON_CLASS =
  "h-5 w-5 rounded-sm [&_svg]:size-3! opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 " +
  "transition-opacity text-muted-foreground/70 dark:text-muted-foreground/70 " +
  "hover:text-foreground/60 hover:bg-foreground/5 active:bg-foreground/8";
const KEBAB_TRIGGER_CLASS = cn(KEBAB_BUTTON_CLASS, "absolute end-1.5");
const KEBAB_HEAD_BUTTON_CLASS = cn(
  KEBAB_BUTTON_CLASS,
  "shrink-0 rounded-md opacity-100 group-hover:opacity-100"
);
const MENU_ITEM_CLASS = "text-xs gap-2 rounded-md px-2 py-1";

function getFileManagerName(): string {
  const platform = getCachedPlatform();
  return platform === "darwin" ? "Finder" : platform === "win32" ? "Explorer" : "Files";
}

interface LocalNotesTreeProps {
  onNewNote: (spaceId: number, folderId: number | null) => void;
  onShowStructureIntro?: () => void;
  /** Deletes a note (IPC `db-delete-note`); the tree's per-row action calls it. */
  onDeleteNote?: (id: number) => void;
}

/**
 * Local-only notes tree (replaces the cloud SpacesTree after the account/cloud
 * purge, 2026-08-09): the default private space, its folders and root notes.
 * Team spaces, workspaces, sharing and upsells were removed upstream.
 *
 * The per-row action menus port the affordances the upstream v1.10.2 SpacesTree
 * offered, on the local-only tree: note → (show in file manager) / delete, and
 * folder → rename (inline input) / delete (confirm dialog). Default folders keep
 * the upstream rule: no rename, no delete, no menu. See
 * docs/upstream-merge/exclusions.txt [excluded-reviewed].
 */
export default function LocalNotesTree({
  onNewNote,
  onShowStructureIntro,
  onDeleteNote,
}: LocalNotesTreeProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  const showConfirmDialog = (options: Omit<typeof confirmDialog, "open">) =>
    setConfirmDialog({ ...options, open: true });
  const hideConfirmDialog = () => setConfirmDialog({ open: false, title: "", onConfirm: () => {} });

  const spaces = useSpaces();
  const folders = useFolders();
  const folderCounts = useFolderCounts();
  const notesByContainer = useNotesByContainer();
  const activeContext = useActiveContext();
  const activeFolderId = useActiveFolderId();
  const activeNoteId = useActiveNoteId();
  const noteFilesEnabled = useSettingsStore((s) => s.noteFilesEnabled);

  const fileManagerName = useMemo(getFileManagerName, []);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const privateSpace = useMemo(() => spaces.find((s) => s.kind === "private") ?? null, [spaces]);
  const privateFolders = useMemo(
    () => (privateSpace ? folders.filter((f) => f.space_id === privateSpace.id) : []),
    [folders, privateSpace]
  );
  const rootNotes = useMemo(() => {
    if (!privateSpace) return [];
    return notesByContainer[spaceContainerKey(privateSpace.id)] ?? [];
  }, [notesByContainer, privateSpace]);

  const isFolderActive = (folderId: number) =>
    activeContext?.folderId === folderId || activeFolderId === folderId;

  const handleFolderClick = (spaceId: number, folderId: number) => {
    setActiveContext(spaceId, folderId);
  };

  const confirmCreateFolder = async () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!name || !privateSpace) return;
    const result = await createFolder(name, privateSpace.id);
    if (result.success && result.folder) {
      setActiveContext(privateSpace.id, result.folder.id);
    }
  };

  // ── Folder actions (port of the upstream SpacesTree folder row) ─────────────

  const startRenameFolder = (folder: FolderItem) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
  };

  const confirmRename = async () => {
    const folderId = renamingFolderId;
    const trimmed = renameValue.trim();
    setRenamingFolderId(null);
    setRenameValue("");
    if (folderId == null || !trimmed) return;
    const result = await renameFolder(folderId, trimmed);
    if (!result.success && result.error) {
      toast({
        title: t("notes.folders.couldNotRename"),
        description: t(localMutationErrorKey(result.error)),
        variant: "destructive",
      });
    }
  };

  const requestDeleteFolder = (folder: FolderItem) => {
    const count = folderCounts[folder.id] ?? 0;
    showConfirmDialog({
      title: t("notes.folders.deleteTitle"),
      description:
        count > 0
          ? t("notes.folders.deleteDescription", { name: folder.name, count })
          : t("notes.folders.deleteDescriptionEmpty", { name: folder.name }),
      confirmText: t("notes.folders.deleteConfirm"),
      variant: "destructive",
      onConfirm: async () => {
        const result = await deleteFolder(folder.id);
        if (!result.success && result.error) {
          toast({
            title: t("notes.folders.couldNotDelete"),
            description: t(localMutationErrorKey(result.error)),
            variant: "destructive",
          });
        }
      },
    });
  };

  if (!privateSpace) {
    return null;
  }

  const spaceKey = spaceContainerKey(privateSpace.id);

  const renderNote = (note: NoteItem) => {
    const isActive = activeNoteId === note.id;
    const hasKebab = noteFilesEnabled || onDeleteNote != null;
    return (
      <div key={note.id} role="none" className={cn("group relative", hasKebab && "pe-11")}>
        <div
          onClick={() => setActiveNoteId(note.id)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pl-6 pr-1.5 text-xs transition-colors duration-150",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-foreground/50 hover:bg-foreground/4 dark:hover:bg-white/4"
          )}
        >
          <FileText size={11} className="shrink-0 text-foreground/30" />
          <span className="truncate flex-1 text-left">
            {note.title || t("notes.list.untitled")}
          </span>
        </div>
        {hasKebab && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.actions")}
                onClick={(e) => e.stopPropagation()}
                className={KEBAB_TRIGGER_CLASS}
              >
                <MoreHorizontal size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4} className="min-w-40">
              {noteFilesEnabled && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      window.electronAPI?.showNoteFile?.(note.id);
                    }}
                    className={MENU_ITEM_CLASS}
                  >
                    <ExternalLink size={11} className="text-muted-foreground/70" />
                    {t("notes.context.showInFileManager", { manager: fileManagerName })}
                  </DropdownMenuItem>
                  {onDeleteNote && <DropdownMenuSeparator />}
                </>
              )}
              {onDeleteNote && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className={cn(
                    MENU_ITEM_CLASS,
                    "text-destructive focus:text-destructive focus:bg-destructive/10"
                  )}
                >
                  <Trash2 size={11} />
                  {t("notes.context.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-4">
      <div className="flex items-center gap-1 pr-1">
        <button
          onClick={() => toggleContainerExpanded(spaceKey)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-foreground/70 hover:bg-foreground/4 dark:hover:bg-white/4"
        >
          <ChevronRight
            size={12}
            className={cn(
              "shrink-0 text-foreground/30 transition-transform duration-150",
              "rotate-90"
            )}
          />
          <span className="truncate">{t("notes.spaces.personal")}</span>
        </button>
        <button
          onClick={() => {
            setCreatingFolder(true);
            setNewFolderName("");
          }}
          className={KEBAB_HEAD_BUTTON_CLASS}
          aria-label={t("notes.folders.create")}
        >
          <FilePlus size={12} />
        </button>
        <button
          onClick={() => onNewNote(privateSpace.id, null)}
          className={KEBAB_HEAD_BUTTON_CLASS}
          aria-label={t("notes.list.newNote")}
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="mt-0.5 space-y-px">
        {privateFolders.map((folder: FolderItem) => {
          const folderKey = folderContainerKey(folder.id);
          const active = isFolderActive(folder.id);
          const folderNotes = notesByContainer[folderKey];
          const isRenaming = renamingFolderId === folder.id;
          const hasKebab = !folder.is_default;
          return (
            <div key={folder.id}>
              {isRenaming ? (
                <div className="pr-2 pl-4">
                  <input
                    dir="auto"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void confirmRename();
                      if (e.key === "Escape") {
                        setRenamingFolderId(null);
                        setRenameValue("");
                      }
                    }}
                    onBlur={() => void confirmRename()}
                    placeholder={t("notes.folders.folderName")}
                    className={cn(FOLDER_INPUT_CLASS, "placeholder:text-foreground/20")}
                  />
                </div>
              ) : (
                <>
                  <div
                    role="none"
                    className={cn(
                      "group relative flex w-full items-center gap-1.5 rounded-md py-1 text-xs transition-colors duration-150",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/60 hover:bg-foreground/4 dark:hover:bg-white/4",
                      hasKebab ? "pe-11" : "pr-1.5"
                    )}
                  >
                    <button
                      onClick={() => toggleContainerExpanded(folderKey)}
                      className="shrink-0 cursor-pointer"
                      aria-label={t("common.actions")}
                    >
                      <ChevronRight
                        size={12}
                        className={cn(
                          "shrink-0 text-foreground/25 transition-transform duration-150",
                          active && "rotate-90"
                        )}
                      />
                    </button>
                    <FolderOpen size={12} className="shrink-0 text-foreground/40" />
                    <button
                      onClick={() => handleFolderClick(privateSpace.id, folder.id)}
                      className="min-w-0 flex-1 cursor-pointer truncate text-left"
                    >
                      {folder.name}
                    </button>
                    <span className="shrink-0 text-[10px] tabular-nums text-foreground/30">
                      {folderCounts[folder.id] ?? 0}
                    </span>
                    {hasKebab && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("common.actions")}
                            onClick={(e) => e.stopPropagation()}
                            className={KEBAB_TRIGGER_CLASS}
                          >
                            <MoreHorizontal size={12} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={4} className="min-w-32">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenameFolder(folder);
                            }}
                            className={MENU_ITEM_CLASS}
                          >
                            <Pencil size={11} className="text-muted-foreground/70" />
                            {t("notes.context.rename")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteFolder(folder);
                            }}
                            className={cn(
                              MENU_ITEM_CLASS,
                              "text-destructive focus:text-destructive focus:bg-destructive/10"
                            )}
                          >
                            <Trash2 size={11} />
                            {t("notes.context.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {active && (
                    <div className="space-y-px">{(folderNotes ?? []).map(renderNote)}</div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {creatingFolder && (
          <div className="pr-2 pl-4">
            <input
              dir="auto"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmCreateFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
              onBlur={confirmCreateFolder}
              placeholder={t("notes.folders.folderName")}
              className={cn(FOLDER_INPUT_CLASS, "placeholder:text-foreground/20")}
            />
          </div>
        )}

        {rootNotes.length > 0 && <div className="space-y-px">{rootNotes.map(renderNote)}</div>}
      </div>

      {onShowStructureIntro && (
        <button
          onClick={onShowStructureIntro}
          className="mt-3 w-full rounded-md px-1.5 py-1 text-left text-[11px] text-foreground/35 hover:text-foreground/60 hover:bg-foreground/3 transition-colors"
        >
          {t("notes.tree.structureIntroHint", {
            defaultValue: "Afficher l'aide sur les notes",
          })}
        </button>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant ?? "destructive"}
        confirmText={confirmDialog.confirmText}
      />
    </div>
  );
}
