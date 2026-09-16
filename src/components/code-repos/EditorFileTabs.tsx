import { useRef, useState, type DragEvent } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { EditorTab } from "./editor-tabs";

const TAB_DRAG_MIME = "application/x-aistudio-editor-tab";
export const FILE_TREE_DRAG_MIME = "application/x-aistudio-file-tree";

export type EditorPaneId = "primary" | "secondary";

export type TabDragPayload = {
  path: string;
  fromPane: EditorPaneId;
};

export type FileTreeDragPayload = {
  path: string;
  name: string;
};

export function readTabDragPayload(dataTransfer: DataTransfer): TabDragPayload | null {
  const raw =
    dataTransfer.getData(TAB_DRAG_MIME) ||
    dataTransfer.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TabDragPayload;
    if (parsed?.path && (parsed.fromPane === "primary" || parsed.fromPane === "secondary")) {
      return parsed;
    }
  } catch {
    // ignore non-JSON payloads
  }
  return null;
}

export function readFileTreeDragPayload(dataTransfer: DataTransfer): FileTreeDragPayload | null {
  const raw = dataTransfer.getData(FILE_TREE_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FileTreeDragPayload;
    if (parsed?.path && parsed?.name) return parsed;
  } catch {
    // ignore
  }
  return null;
}

/** True when the drag carries an editor tab or a file-tree file. */
export function isEditorDropDrag(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes(TAB_DRAG_MIME) ||
    dataTransfer.types.includes(FILE_TREE_DRAG_MIME) ||
    dataTransfer.types.includes("text/plain")
  );
}

export function writeFileTreeDragPayload(
  dataTransfer: DataTransfer,
  file: FileTreeDragPayload,
): void {
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setData(FILE_TREE_DRAG_MIME, JSON.stringify(file));
  dataTransfer.setData("text/plain", file.path);
}

export function EditorFileTabs({
  paneId,
  tabs,
  activePath,
  onActivate,
  onClose,
  onDropTab,
  onOpenFile,
}: {
  paneId: EditorPaneId;
  tabs: EditorTab[];
  activePath: string | null;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  /** Same-pane reorder or cross-pane move. `beforePath` null = append. */
  onDropTab?: (payload: TabDragPayload & { beforePath: string | null }) => void;
  /** Open a file dragged from the file tree into this pane. */
  onOpenFile?: (file: FileTreeDragPayload, beforePath: string | null) => void;
}) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [dropOnEnd, setDropOnEnd] = useState(false);
  const didDragRef = useRef(false);

  const canDrop = Boolean(onDropTab || onOpenFile);

  function clearDropState() {
    setDraggingPath(null);
    setDropTargetPath(null);
    setDropOnEnd(false);
  }

  function handleDrop(event: DragEvent, beforePath: string | null) {
    event.preventDefault();
    event.stopPropagation();

    const filePayload = readFileTreeDragPayload(event.dataTransfer);
    if (filePayload && onOpenFile) {
      didDragRef.current = true;
      onOpenFile(filePayload, beforePath);
      clearDropState();
      return;
    }

    if (!onDropTab) {
      clearDropState();
      return;
    }

    const payload = readTabDragPayload(event.dataTransfer);
    if (!payload) {
      clearDropState();
      return;
    }
    if (payload.fromPane === paneId && beforePath === payload.path) {
      clearDropState();
      return;
    }
    didDragRef.current = true;
    onDropTab({ ...payload, beforePath });
    clearDropState();
  }

  return (
    <div
      className={cn(
        "flex min-h-8 shrink-0 items-stretch overflow-x-auto border-b border-line bg-bg",
        dropOnEnd && "ring-1 ring-inset ring-accent/40",
      )}
      onDragOver={(event) => {
        if (!canDrop || !isEditorDropDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(FILE_TREE_DRAG_MIME)
          ? "copy"
          : "move";
        if (tabs.length === 0 || event.currentTarget === event.target) {
          setDropOnEnd(true);
          setDropTargetPath(null);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropOnEnd(false);
      }}
      onDrop={(event) => handleDrop(event, null)}
    >
      {tabs.length === 0 && (
        <div className="flex flex-1 items-center px-3 text-[10px] text-faint">
          {canDrop ? "Drop a file or tab here" : "No open files"}
        </div>
      )}

      {tabs.map((tab) => {
        const active = tab.path === activePath;
        const isDragging = draggingPath === tab.path;
        const isDropTarget = dropTargetPath === tab.path && draggingPath !== tab.path;

        return (
          <div
            key={tab.path}
            draggable={Boolean(onDropTab)}
            onDragStart={(event) => {
              if (!onDropTab) return;
              didDragRef.current = false;
              setDraggingPath(tab.path);
              const payload: TabDragPayload = { path: tab.path, fromPane: paneId };
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(payload));
              event.dataTransfer.setData("text/plain", JSON.stringify(payload));
            }}
            onDragEnd={clearDropState}
            onDragOver={(event) => {
              if (!canDrop || !isEditorDropDrag(event.dataTransfer)) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = event.dataTransfer.types.includes(FILE_TREE_DRAG_MIME)
                ? "copy"
                : "move";
              setDropOnEnd(false);
              if (dropTargetPath !== tab.path) setDropTargetPath(tab.path);
            }}
            onDragLeave={() => {
              if (dropTargetPath === tab.path) setDropTargetPath(null);
            }}
            onDrop={(event) => handleDrop(event, tab.path)}
            className={cn(
              "group relative flex max-w-[12rem] shrink-0 items-stretch border-r border-line",
              onDropTab && "cursor-grab active:cursor-grabbing",
              active ? "bg-surface text-ink" : "text-mid hover:bg-surface-hover hover:text-ink",
              isDragging && "opacity-40",
              isDropTarget && "bg-accent/8",
            )}
          >
            {isDropTarget && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
            )}
            <button
              type="button"
              title={onDropTab ? `${tab.path} · drag to reorder or move panes` : tab.path}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                onActivate(tab.path);
              }}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(tab.path);
                }
              }}
              className="flex min-w-0 flex-1 items-center px-2.5 py-1.5 text-left text-[11px]"
            >
              <span className="min-w-0 truncate">{tab.name}</span>
            </button>
            <button
              type="button"
              title={`Close ${tab.name}`}
              aria-label={`Close ${tab.name}`}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className={cn(
                "flex items-center px-1.5 text-light hover:text-ink",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              <X size={10} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
