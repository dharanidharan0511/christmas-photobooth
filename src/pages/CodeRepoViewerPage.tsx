import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns2,
  Copy,
  Download,
  Eye,
  EyeOff,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  Loader2,
  Maximize2,
  Minimize2,
  Rows2,
  Square,
  Upload,
} from "lucide-react";
import {
  CodeFileViewer,
  downloadTextFile,
  getFileTextContent,
  type EditorTextSelection,
} from "../components/code-repos/CodeFileViewer";
import { FilePathBreadcrumb } from "../components/code-repos/FilePathBreadcrumb";
import {
  EditorFileTabs,
  isEditorDropDrag,
  readFileTreeDragPayload,
  readTabDragPayload,
  writeFileTreeDragPayload,
  FILE_TREE_DRAG_MIME,
  type EditorPaneId,
  type FileTreeDragPayload,
} from "../components/code-repos/EditorFileTabs";
import {
  activateEditorTab,
  activeEditorFile,
  closeEditorTab,
  emptyEditorPane,
  moveEditorTabBetweenPanes,
  openEditorTab,
  reorderEditorTabs,
  type EditorPaneState,
  type EditorTab,
} from "../components/code-repos/editor-tabs";
import { CodeRepoChatPanel } from "../components/code-repos/CodeRepoChatPanel";
import { ProjectViewNav } from "../components/code-repos/ProjectViewNav";
import { UploadCodeRepoModal, type UploadCodeRepoFormValues } from "../components/code-repos/UploadCodeRepoModal";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { Spinner } from "../components/ui/Spinner";
import {
  defaultBranchLabel,
  mapFileResponse,
  resolveRepoBrowseSource,
} from "../lib/code-repos";
import {
  EngineApiError,
  getCodeRepo,
  getCodeRepoFile,
  getCodeRepoTree,
  listCodeRepoBranches,
  uploadCodeRepoFiles,
} from "../lib/engineClient";
import { useHighlightTheme } from "../hooks/useHighlightTheme";
import { fileBaseName, isPreviewableFile } from "../lib/code-repo-file-utils";
import type { CodeRepoTreeEntry } from "../types/codeRepos";
import { cn } from "../lib/utils";

type SplitMode = "single" | "vertical" | "horizontal";
type ActivePanel = "primary" | "secondary";
type SelectedFile = EditorTab;

interface BrowseContext {
  source: "workspace" | "git" | "vcs";
  branch?: string;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "py", "json", "toml", "md"].includes(ext)) {
    return FileCode2;
  }
  return File;
}

function treeQueryKey(repoId: string, path: string, browse: BrowseContext) {
  return ["code-repo-tree", repoId, path, browse.source, browse.branch ?? ""] as const;
}

function fileQueryKey(repoId: string, path: string, browse: BrowseContext) {
  return ["code-repo-file", repoId, path, browse.source, browse.branch ?? ""] as const;
}

function TreeNode({
  repoId,
  browse,
  entry,
  depth,
  selectedPath,
  openPaths,
  expandedPaths,
  onToggleDir,
  onSelectFile,
}: {
  repoId: string;
  browse: BrowseContext;
  entry: CodeRepoTreeEntry;
  depth: number;
  selectedPath: string | null;
  openPaths: Set<string>;
  expandedPaths: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (entry: CodeRepoTreeEntry) => void;
}) {
  const isDir = entry.type === "dir";
  const isExpanded = isDir && expandedPaths.has(entry.path);
  const isSelected = !isDir && selectedPath === entry.path;
  const isOpen = !isDir && !isSelected && openPaths.has(entry.path);
  const Icon = isDir ? (isExpanded ? FolderOpen : Folder) : fileIcon(entry.name);

  const childrenQuery = useInfiniteQuery({
    queryKey: treeQueryKey(repoId, entry.path, browse),
    queryFn: ({ pageParam, signal }) =>
      getCodeRepoTree(
        repoId,
        {
          path: entry.path,
          source: browse.source,
          branch: browse.branch,
          cursor: pageParam,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      if (!last.truncated || last.nextCursor == null || last.nextCursor === "") return undefined;
      const cursor = Number(last.nextCursor);
      return Number.isFinite(cursor) ? cursor : undefined;
    },
    enabled: isDir && isExpanded,
    staleTime: 30_000,
  });

  const children = childrenQuery.data?.pages.flatMap((page) => page.entries) ?? [];

  const didDragRef = useRef(false);

  return (
    <div>
      <button
        type="button"
        draggable={!isDir}
        title={isDir ? undefined : `${entry.path} · drag into an editor pane`}
        onDragStart={(event) => {
          if (isDir) return;
          didDragRef.current = false;
          writeFileTreeDragPayload(event.dataTransfer, {
            path: entry.path,
            name: entry.name,
          });
          // Mark after a tick so a short click still opens; real drags set this.
          requestAnimationFrame(() => {
            didDragRef.current = true;
          });
        }}
        onDragEnd={() => {
          // Keep the flag long enough to suppress the synthetic click after drag.
          window.setTimeout(() => {
            didDragRef.current = false;
          }, 0);
        }}
        onClick={() => {
          if (isDir) {
            onToggleDir(entry.path);
            return;
          }
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          onSelectFile(entry);
        }}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
          !isDir && "cursor-grab active:cursor-grabbing",
          isSelected
            ? "bg-accent-soft font-medium text-accent-text"
            : isOpen
              ? "text-ink hover:bg-surface-hover"
              : "text-mid hover:bg-surface-hover hover:text-ink",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {isDir ? (
          isExpanded ? (
            <ChevronDown size={14} className="shrink-0 text-light" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-light" />
          )
        ) : (
          <span className="inline-block w-3.5 shrink-0" />
        )}
        <Icon size={15} className="shrink-0 text-light" strokeWidth={1.5} />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>

      {isDir && isExpanded && (
        <div>
          {childrenQuery.isLoading && (
            <div
              className="flex items-center gap-1 py-1 text-xs text-light"
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
            >
              <Loader2 size={12} className="animate-spin" />
              Loading…
            </div>
          )}
          {children.map((child) => (
            <TreeNode
              key={child.path}
              repoId={repoId}
              browse={browse}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              openPaths={openPaths}
              expandedPaths={expandedPaths}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
            />
          ))}
          {childrenQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void childrenQuery.fetchNextPage()}
              disabled={childrenQuery.isFetchingNextPage}
              className="py-1 text-left text-xs text-accent hover:underline disabled:opacity-50"
              style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
            >
              {childrenQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilePanel({
  repoId,
  browse,
  selectedFile,
  previewMode,
  enabled,
  onSelectionChange,
  onAddSelection,
}: {
  repoId: string;
  browse: BrowseContext;
  selectedFile: SelectedFile | null;
  previewMode: boolean;
  enabled: boolean;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  onAddSelection?: (selection: EditorTextSelection) => void;
}) {
  const fileQuery = useQuery({
    queryKey: selectedFile ? fileQueryKey(repoId, selectedFile.path, browse) : ["code-repo-file", "idle"],
    queryFn: ({ signal }) =>
      getCodeRepoFile(
        repoId,
        { path: selectedFile!.path, source: browse.source, branch: browse.branch },
        signal,
      ),
    enabled: enabled && Boolean(selectedFile?.path),
    staleTime: 60_000,
  });

  const file = mapFileResponse(fileQuery.data);
  const errorMessage =
    fileQuery.error instanceof EngineApiError && fileQuery.error.status === 404
      ? "File not found on this edge cluster"
      : fileQuery.error instanceof Error
        ? fileQuery.error.message
        : null;

  return (
    <CodeFileViewer
      key={`${browse.source}:${browse.branch ?? ""}:${selectedFile?.path ?? ""}:${previewMode ? "preview" : "code"}`}
      path={selectedFile?.path ?? null}
      file={file}
      previewMode={previewMode}
      isLoading={fileQuery.isLoading}
      errorMessage={errorMessage}
      onSelectionChange={enabled ? onSelectionChange : undefined}
      onAddSelection={enabled ? onAddSelection : undefined}
    />
  );
}

function EditorPane({
  paneId,
  repoId,
  browse,
  pane,
  previewMode,
  enabled,
  isFocused,
  onActivate,
  onClose,
  onDropTab,
  onOpenFile,
  onFocus,
  onSelectionChange,
  onAddSelection,
}: {
  paneId: EditorPaneId;
  repoId: string;
  browse: BrowseContext;
  pane: EditorPaneState;
  previewMode: boolean;
  enabled: boolean;
  isFocused: boolean;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onDropTab: (payload: {
    path: string;
    fromPane: EditorPaneId;
    beforePath: string | null;
  }) => void;
  onOpenFile: (file: FileTreeDragPayload, beforePath: string | null) => void;
  onFocus: () => void;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  onAddSelection?: (selection: EditorTextSelection) => void;
}) {
  const activeFile = activeEditorFile(pane);
  const [contentDropActive, setContentDropActive] = useState(false);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        contentDropActive && "ring-2 ring-inset ring-accent/50",
      )}
      onClick={onFocus}
      onDragOver={(event) => {
        if (!isEditorDropDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(FILE_TREE_DRAG_MIME)
          ? "copy"
          : "move";
        if (!contentDropActive) setContentDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setContentDropActive(false);
      }}
      onDrop={(event) => {
        // Tab bar handles its own drops (stopPropagation). Content drops land here.
        event.preventDefault();
        setContentDropActive(false);

        const filePayload = readFileTreeDragPayload(event.dataTransfer);
        if (filePayload) {
          onOpenFile(filePayload, null);
          onFocus();
          return;
        }

        const payload = readTabDragPayload(event.dataTransfer);
        if (!payload) return;
        // Same pane + already here: just focus; don't reshuffle.
        if (payload.fromPane === paneId && pane.tabs.some((tab) => tab.path === payload.path)) {
          onActivate(payload.path);
          onFocus();
          return;
        }
        onDropTab({ ...payload, beforePath: null });
        onFocus();
      }}
    >
      <EditorFileTabs
        paneId={paneId}
        tabs={pane.tabs}
        activePath={pane.activePath}
        onActivate={onActivate}
        onClose={onClose}
        onDropTab={onDropTab}
        onOpenFile={onOpenFile}
      />
      <div
        className={cn(
          "relative min-h-0 flex-1",
          isFocused && "ring-2 ring-inset ring-accent",
          contentDropActive && "bg-accent/5",
        )}
      >
        {pane.tabs.length === 0 ? (
          <FilePanel
            repoId={repoId}
            browse={browse}
            selectedFile={null}
            previewMode={previewMode}
            enabled={enabled}
            onSelectionChange={onSelectionChange}
            onAddSelection={onAddSelection}
          />
        ) : (
          pane.tabs.map((tab) => {
            const isActive = tab.path === activeFile?.path;
            return (
              <div
                key={tab.path}
                className={cn(
                  "absolute inset-0 flex flex-col",
                  isActive ? "z-10" : "invisible pointer-events-none z-0",
                )}
              >
                <FilePanel
                  repoId={repoId}
                  browse={browse}
                  selectedFile={tab}
                  previewMode={previewMode}
                  enabled={enabled && isActive}
                  onSelectionChange={onSelectionChange}
                  onAddSelection={onAddSelection}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CodeRepoViewerPage() {
  useHighlightTheme();
  const queryClient = useQueryClient();

  const { repoId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const repoQuery = useQuery({
    queryKey: ["code-repo", repoId],
    queryFn: ({ signal }) => getCodeRepo(repoId, signal),
    enabled: Boolean(repoId),
  });

  const repo = repoQuery.data;
  const defaultBranch = defaultBranchLabel(repo?.defaultBranch);
  const branch = searchParams.get("branch") ?? defaultBranch;

  const setBranch = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("branch", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const browse = useMemo(
    (): BrowseContext => resolveRepoBrowseSource(branch, defaultBranch, repo),
    [branch, defaultBranch, repo?.edgeConnectorRef],
  );

  const branchesQuery = useQuery({
    queryKey: ["code-repo-branches", repoId],
    queryFn: ({ signal }) => listCodeRepoBranches(repoId, signal),
    enabled: Boolean(repo),
    staleTime: 60_000,
  });

  const branchOptions = useMemo(() => {
    const fromApi = branchesQuery.data ?? [];
    const options = fromApi.map((item) => ({
      value: item.name,
      label: item.isDefault ? `${item.name} (default)` : item.name,
    }));
    if (branch && !options.some((option) => option.value === branch)) {
      options.unshift({ value: branch, label: branch });
    }
    if (options.length === 0) {
      options.push({ value: defaultBranch, label: `${defaultBranch} (default)` });
    }
    return options;
  }, [branch, branchesQuery.data, defaultBranch]);

  const remoteLabel = useMemo(() => {
    if (!repo) return null;
    if (repo.githubRepoFullName?.trim()) return repo.githubRepoFullName.trim();
    if (repo.bitbucketRepoFullName?.trim()) return repo.bitbucketRepoFullName.trim();
    if (repo.gitlabUrl?.trim()) return repo.gitlabUrl.trim();
    return null;
  }, [repo]);

  const rootTreeQuery = useInfiniteQuery({
    queryKey: treeQueryKey(repoId, "", browse),
    queryFn: ({ pageParam, signal }) =>
      getCodeRepoTree(
        repoId,
        { path: "", source: browse.source, branch: browse.branch, cursor: pageParam },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      if (!last.truncated || last.nextCursor == null || last.nextCursor === "") return undefined;
      const cursor = Number(last.nextCursor);
      return Number.isFinite(cursor) ? cursor : undefined;
    },
    enabled: Boolean(repo),
    staleTime: 30_000,
  });

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 768;
    return true;
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [primaryPane, setPrimaryPane] = useState<EditorPaneState>(emptyEditorPane);
  const [secondaryPane, setSecondaryPane] = useState<EditorPaneState>(emptyEditorPane);
  const [splitMode, setSplitMode] = useState<SplitMode>("single");
  const [activePanel, setActivePanel] = useState<ActivePanel>("primary");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [copyHint, setCopyHint] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editorSelection, setEditorSelection] = useState<EditorTextSelection | null>(null);
  const [selectionToAdd, setSelectionToAdd] = useState<EditorTextSelection | null>(null);

  const onAddSelection = useCallback((selection: EditorTextSelection) => {
    setEditorSelection(selection);
    setSelectionToAdd(selection);
  }, []);

  const onSelectionAdded = useCallback(() => {
    setSelectionToAdd(null);
  }, []);

  const primaryPaneRef = useRef(primaryPane);
  const secondaryPaneRef = useRef(secondaryPane);
  primaryPaneRef.current = primaryPane;
  secondaryPaneRef.current = secondaryPane;

  const handleTabDrop = useCallback(
    (
      targetPane: EditorPaneId,
      payload: { path: string; fromPane: EditorPaneId; beforePath: string | null },
    ) => {
      const { path, fromPane, beforePath } = payload;
      const primary = primaryPaneRef.current;
      const secondary = secondaryPaneRef.current;

      if (fromPane === targetPane) {
        if (beforePath === path) return;
        const pane = targetPane === "primary" ? primary : secondary;
        if (!beforePath) {
          const fromIndex = pane.tabs.findIndex((tab) => tab.path === path);
          if (fromIndex < 0 || fromIndex === pane.tabs.length - 1) return;
          const tabs = [...pane.tabs];
          const [moved] = tabs.splice(fromIndex, 1);
          tabs.push(moved);
          if (targetPane === "primary") setPrimaryPane({ ...pane, tabs });
          else setSecondaryPane({ ...pane, tabs });
        } else {
          if (targetPane === "primary") {
            setPrimaryPane(reorderEditorTabs(pane, path, beforePath));
          } else {
            setSecondaryPane(reorderEditorTabs(pane, path, beforePath));
          }
        }
        setActivePanel(targetPane);
        return;
      }

      const source = fromPane === "primary" ? primary : secondary;
      const dest = targetPane === "primary" ? primary : secondary;
      const { fromPane: nextFrom, toPane: nextTo } = moveEditorTabBetweenPanes(
        source,
        dest,
        path,
        beforePath,
      );

      setPrimaryPane(
        fromPane === "primary" ? nextFrom : targetPane === "primary" ? nextTo : primary,
      );
      setSecondaryPane(
        fromPane === "secondary" ? nextFrom : targetPane === "secondary" ? nextTo : secondary,
      );
      setActivePanel(targetPane);
    },
    [],
  );

  const uploadMutation = useMutation({
    mutationFn: (input: UploadCodeRepoFormValues) =>
      uploadCodeRepoFiles(input.repoId, {
        files: input.files,
        commitMessage: input.commitMessage,
        branch: input.branch,
      }),
    onSuccess: async (result) => {
      setUploadError(null);
      setUploadOpen(false);
      if (result.branch && result.branch !== branch) {
        setBranch(result.branch);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["code-repo-tree", repoId] }),
        queryClient.invalidateQueries({ queryKey: ["code-repo-file", repoId] }),
        queryClient.invalidateQueries({ queryKey: ["code-repo-branches", repoId] }),
      ]);
    },
    onError: (error: Error) => {
      setUploadError(error.message);
    },
  });

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    setExpandedPaths(new Set());
    setPrimaryPane(emptyEditorPane());
    setSecondaryPane(emptyEditorPane());
    setPreviewMode(false);
  }, [branch, repoId, browse.source]);

  const onToggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandParents = useCallback((path: string) => {
    const parts = path.split("/");
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      let current = "";
      for (let i = 0; i < parts.length - 1; i += 1) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        next.add(current);
      }
      return next;
    });
  }, []);

  const handleOpenFileDrop = useCallback(
    (
      targetPane: EditorPaneId,
      file: FileTreeDragPayload,
      beforePath: string | null,
    ) => {
      expandParents(file.path);
      const tab: SelectedFile = { path: file.path, name: file.name };
      if (targetPane === "primary") {
        setPrimaryPane((pane) => openEditorTab(pane, tab, beforePath));
      } else {
        setSecondaryPane((pane) => openEditorTab(pane, tab, beforePath));
      }
      setActivePanel(targetPane);
      setPreviewMode(false);
    },
    [expandParents],
  );

  const onSelectFile = useCallback(
    (entry: CodeRepoTreeEntry) => {
      const file: SelectedFile = { path: entry.path, name: entry.name };
      expandParents(entry.path);

      if (splitMode !== "single" && activePanel === "secondary") {
        setSecondaryPane((pane) => openEditorTab(pane, file));
      } else {
        setPrimaryPane((pane) => openEditorTab(pane, file));
      }

      setPreviewMode(false);

      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    },
    [activePanel, expandParents, splitMode],
  );

  const collapseAll = useCallback(() => setExpandedPaths(new Set()), []);

  const currentPane =
    splitMode !== "single" && activePanel === "secondary" ? secondaryPane : primaryPane;
  const currentFile = activeEditorFile(currentPane);
  const openPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const tab of primaryPane.tabs) paths.add(tab.path);
    if (splitMode !== "single") {
      for (const tab of secondaryPane.tabs) paths.add(tab.path);
    }
    return paths;
  }, [primaryPane.tabs, secondaryPane.tabs, splitMode]);
  const openEditorFiles = useMemo(() => {
    const files: SelectedFile[] = [];
    const seen = new Set<string>();
    for (const tab of primaryPane.tabs) {
      if (seen.has(tab.path)) continue;
      seen.add(tab.path);
      files.push(tab);
    }
    if (splitMode !== "single") {
      for (const tab of secondaryPane.tabs) {
        if (seen.has(tab.path)) continue;
        seen.add(tab.path);
        files.push(tab);
      }
    }
    return files;
  }, [primaryPane.tabs, secondaryPane.tabs, splitMode]);
  const onOpenFileFromChat = useCallback(
    (path: string) => {
      const file: SelectedFile = { path, name: fileBaseName(path) };
      expandParents(path);
      if (splitMode !== "single" && activePanel === "secondary") {
        setSecondaryPane((pane) => openEditorTab(pane, file));
      } else {
        setPrimaryPane((pane) => openEditorTab(pane, file));
      }
    },
    [activePanel, expandParents, splitMode],
  );
  const onRepoFilesChanged = useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["code-repo-tree", repoId] });
      void queryClient.invalidateQueries({ queryKey: ["code-repo-file", repoId] });
      void queryClient.invalidateQueries({ queryKey: ["code-repo-file-index", repoId] });
      void queryClient.invalidateQueries({ queryKey: ["code-repo-branches", repoId] });
    }, [queryClient, repoId]);
  const canPreview = currentFile ? isPreviewableFile(currentFile.name) : false;

  useEffect(() => {
    setEditorSelection(null);
  }, [activePanel, currentFile?.path]);

  useEffect(() => {
    if (currentFile && !isPreviewableFile(currentFile.name)) {
      setPreviewMode(false);
    }
  }, [currentFile]);

  const fetchCurrentFile = useCallback(async () => {
    if (!currentFile) return null;
    const response = await queryClient.fetchQuery({
      queryKey: fileQueryKey(repoId, currentFile.path, browse),
      queryFn: ({ signal }) =>
        getCodeRepoFile(
          repoId,
          { path: currentFile.path, source: browse.source, branch: browse.branch },
          signal,
        ),
      staleTime: 60_000,
    });
    return mapFileResponse(response);
  }, [browse, currentFile, queryClient, repoId]);

  const handleDownload = useCallback(async () => {
    const file = await fetchCurrentFile();
    const content = getFileTextContent(file);
    if (!content || !currentFile) return;
    downloadTextFile(content, fileBaseName(currentFile.path));
  }, [currentFile, fetchCurrentFile]);

  const handleCopy = useCallback(async () => {
    const file = await fetchCurrentFile();
    const content = getFileTextContent(file);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopyHint(true);
      window.setTimeout(() => setCopyHint(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }, [fetchCurrentFile]);

  if (repoQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (repoQuery.error instanceof EngineApiError && repoQuery.error.status === 404) {
    return <Navigate to="/code-repos" replace />;
  }

  if (!repo) {
    return (
      <EmptyState
        title="Could not load repository"
        description={repoQuery.error instanceof Error ? repoQuery.error.message : "Unknown error"}
      />
    );
  }

  const rootEntries = rootTreeQuery.data?.pages.flatMap((page) => page.entries) ?? [];
  const treeErrorMessage =
    rootTreeQuery.error instanceof EngineApiError && rootTreeQuery.error.status === 404
      ? browse.source === "vcs"
        ? "Could not load files from the remote repository."
        : "This repository is not cloned on this edge cluster yet."
      : rootTreeQuery.error instanceof Error
        ? rootTreeQuery.error.message
        : null;

  const viewer = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-bg",
        isFullscreen
          ? "fixed inset-0 z-[200] h-screen w-screen"
          : "h-full",
      )}
    >
      {/* Compact toolbar — name/type live in ProjectViewNav; show remote only */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-bg px-4 py-2">
        <div className="min-w-0 flex-1">
          {remoteLabel ? (
            <p className="truncate font-mono text-xs text-mid" title={remoteLabel}>
              {remoteLabel}
            </p>
          ) : (
            <p className="truncate text-xs text-faint">Local workspace</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              setUploadError(null);
              setUploadOpen(true);
            }}
            title="Upload files"
          >
            <Upload size={13} strokeWidth={1.5} />
            Upload
          </Button>
          <div className="flex items-center gap-1.5">
            <GitBranch size={12} strokeWidth={1.75} className="shrink-0 text-mid" />
            <Select
              value={branch}
              onChange={setBranch}
              options={branchOptions}
              disabled={branchesQuery.isLoading && branchOptions.length <= 1}
              ariaLabel="Repository branch"
              className="w-[12rem]"
              triggerClassName="h-8 w-full justify-between font-mono text-xs"
              menuAlign="end"
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        <aside
          className={cn(
            "flex shrink-0 flex-col overflow-hidden border-r border-line bg-bg-subtle transition-all duration-300 md:shadow-none",
            "fixed inset-y-0 left-0 z-[70] h-full shadow-xl md:relative md:inset-auto md:z-0 md:shadow-none",
            sidebarOpen ? "w-60 translate-x-0" : "w-0 -translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Files
            </span>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all folders"
              className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <ChevronsUpDown size={13} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <ChevronLeft size={13} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-3 py-2 md:hidden">
              <span className="text-xs font-medium uppercase tracking-wide text-light">Files</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-mid">
                <GitBranch size={11} />
                {branch}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {rootTreeQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-mid" />
                </div>
              ) : treeErrorMessage ? (
                <EmptyState title="No files available" description={treeErrorMessage} />
              ) : rootEntries.length === 0 ? (
                <EmptyState
                  title="Empty repository"
                  description={
                    browse.source === "vcs"
                      ? "This branch has no files at the repository root."
                      : "This repository has no files in its workspace on this edge cluster."
                  }
                />
              ) : (
                <>
                  {rootEntries.map((entry) => (
                    <TreeNode
                      key={entry.path}
                      repoId={repoId}
                      browse={browse}
                      entry={entry}
                      depth={0}
                      selectedPath={currentFile?.path ?? null}
                      openPaths={openPaths}
                      expandedPaths={expandedPaths}
                      onToggleDir={onToggleDir}
                      onSelectFile={onSelectFile}
                    />
                  ))}
                  {rootTreeQuery.hasNextPage && (
                    <button
                      type="button"
                      onClick={() => void rootTreeQuery.fetchNextPage()}
                      disabled={rootTreeQuery.isFetchingNextPage}
                      className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-accent hover:bg-surface-hover disabled:opacity-50"
                    >
                      {rootTreeQuery.isFetchingNextPage ? "Loading…" : "Load more files"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-1.5">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Open file tree"
                className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <ChevronRight size={13} strokeWidth={1.5} />
              </button>
            )}

            <div className="hidden items-center gap-0.5 md:flex">
              {(["single", "vertical", "horizontal"] as SplitMode[]).map((mode) => {
                const Icon = mode === "single" ? Square : mode === "vertical" ? Columns2 : Rows2;
                const label =
                  mode === "single" ? "Single view" : mode === "vertical" ? "Vertical split" : "Horizontal split";
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSplitMode(mode);
                      if (mode === "single") setActivePanel("primary");
                    }}
                    title={label}
                    className={cn(
                      "rounded p-1 transition-colors",
                      splitMode === mode
                        ? "bg-surface-active text-ink"
                        : "text-mid hover:bg-surface-hover hover:text-ink",
                    )}
                  >
                    <Icon size={13} strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>

            {splitMode !== "single" && (
              <div className="ml-1 flex items-center gap-0.5 border-l border-line pl-2">
                <button
                  type="button"
                  onClick={() => setActivePanel("primary")}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    activePanel === "primary"
                      ? "bg-accent text-bg"
                      : "text-mid hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("secondary")}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    activePanel === "secondary"
                      ? "bg-accent text-bg"
                      : "text-mid hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  Right
                </button>
              </div>
            )}

            <div className="min-w-0 flex-1">
              {currentFile ? (
                <FilePathBreadcrumb path={currentFile.path} />
              ) : (
                <span className="text-[11px] text-faint">No file selected</span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => setIsFullscreen((value) => !value)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink"
              >
                {isFullscreen ? (
                  <Minimize2 size={13} strokeWidth={1.5} />
                ) : (
                  <Maximize2 size={13} strokeWidth={1.5} />
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={!currentFile}
                title="Download file"
                className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-30"
              >
                <Download size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode((value) => !value)}
                disabled={!canPreview}
                title={previewMode ? "Show code" : "Preview"}
                className={cn(
                  "rounded p-1 transition-colors disabled:opacity-30",
                  previewMode ? "bg-accent/10 text-accent" : "text-mid hover:bg-surface-hover hover:text-ink",
                )}
              >
                {previewMode ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!currentFile}
                title={copyHint ? "Copied!" : "Copy contents"}
                className="rounded p-1 text-mid transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-30"
              >
                <Copy size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>

            <div
              className={cn(
                "flex min-h-0 flex-1 overflow-hidden",
                splitMode === "vertical" ? "flex-row" : "flex-col",
              )}
            >
              <EditorPane
                paneId="primary"
                repoId={repoId}
                browse={browse}
                pane={primaryPane}
                previewMode={previewMode}
                enabled={splitMode === "single" || activePanel === "primary"}
                isFocused={splitMode !== "single" && activePanel === "primary"}
                onActivate={(path) => {
                  setActivePanel("primary");
                  setPrimaryPane((pane) => activateEditorTab(pane, path));
                }}
                onClose={(path) => setPrimaryPane((pane) => closeEditorTab(pane, path))}
                onDropTab={(payload) => handleTabDrop("primary", payload)}
                onOpenFile={(file, beforePath) => handleOpenFileDrop("primary", file, beforePath)}
                onFocus={() => splitMode !== "single" && setActivePanel("primary")}
                onSelectionChange={setEditorSelection}
                onAddSelection={onAddSelection}
              />

              {splitMode !== "single" && (
                <>
                  <div className={cn("shrink-0 bg-line-subtle", splitMode === "vertical" ? "w-px" : "h-px")} />
                  <EditorPane
                    paneId="secondary"
                    repoId={repoId}
                    browse={browse}
                    pane={secondaryPane}
                    previewMode={previewMode}
                    enabled={activePanel === "secondary"}
                    isFocused={activePanel === "secondary"}
                    onActivate={(path) => {
                      setActivePanel("secondary");
                      setSecondaryPane((pane) => activateEditorTab(pane, path));
                    }}
                    onClose={(path) => setSecondaryPane((pane) => closeEditorTab(pane, path))}
                    onDropTab={(payload) => handleTabDrop("secondary", payload)}
                    onOpenFile={(file, beforePath) => handleOpenFileDrop("secondary", file, beforePath)}
                    onFocus={() => setActivePanel("secondary")}
                    onSelectionChange={setEditorSelection}
                    onAddSelection={onAddSelection}
                  />
                </>
              )}
            </div>
        </div>

        <CodeRepoChatPanel
          repoId={repo.id}
          repoName={repo.name}
          projectId={repo.projectId}
          branch={branch}
          treeSource={browse.source}
          selectedFilePath={currentFile?.path ?? null}
          openFiles={openEditorFiles}
          onOpenFile={onOpenFileFromChat}
          onRepoFilesChanged={onRepoFilesChanged}
          editorSelection={editorSelection}
          selectionToAdd={selectionToAdd}
          onSelectionAdded={onSelectionAdded}
        />
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        {createPortal(viewer, document.body)}
        <UploadCodeRepoModal
          open={uploadOpen}
          repo={repo}
          initialBranch={branch}
          onClose={() => {
            if (!uploadMutation.isPending) {
              setUploadOpen(false);
              setUploadError(null);
            }
          }}
          onSubmit={(input) => uploadMutation.mutateAsync(input)}
          isSubmitting={uploadMutation.isPending}
          error={uploadError}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectViewNav repoId={repoId} activeTab="code" />
      {viewer}
      <UploadCodeRepoModal
        open={uploadOpen}
        repo={repo}
        initialBranch={branch}
        onClose={() => {
          if (!uploadMutation.isPending) {
            setUploadOpen(false);
            setUploadError(null);
          }
        }}
        onSubmit={(input) => uploadMutation.mutateAsync(input)}
        isSubmitting={uploadMutation.isPending}
        error={uploadError}
      />
    </div>
  );
}
