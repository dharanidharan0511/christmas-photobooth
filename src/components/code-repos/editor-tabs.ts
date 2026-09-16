export type EditorTab = { path: string; name: string };

export type EditorPaneState = {
  tabs: EditorTab[];
  activePath: string | null;
};

export function emptyEditorPane(): EditorPaneState {
  return { tabs: [], activePath: null };
}

export function openEditorTab(
  pane: EditorPaneState,
  file: EditorTab,
  beforePath: string | null = null,
): EditorPaneState {
  if (pane.tabs.some((tab) => tab.path === file.path)) {
    return { ...pane, activePath: file.path };
  }
  const tabs = [...pane.tabs];
  if (beforePath) {
    const at = tabs.findIndex((tab) => tab.path === beforePath);
    if (at >= 0) tabs.splice(at, 0, file);
    else tabs.push(file);
  } else {
    tabs.push(file);
  }
  return { tabs, activePath: file.path };
}

export function activateEditorTab(pane: EditorPaneState, path: string): EditorPaneState {
  if (!pane.tabs.some((tab) => tab.path === path)) return pane;
  return { ...pane, activePath: path };
}

export function closeEditorTab(pane: EditorPaneState, path: string): EditorPaneState {
  const index = pane.tabs.findIndex((tab) => tab.path === path);
  if (index < 0) return pane;
  const tabs = pane.tabs.filter((tab) => tab.path !== path);
  if (pane.activePath !== path) return { ...pane, tabs };
  const neighbor = tabs[index] ?? tabs[index - 1] ?? null;
  return { tabs, activePath: neighbor?.path ?? null };
}

/** Move `fromPath` so it sits at the index currently occupied by `toPath`. */
export function reorderEditorTabs(
  pane: EditorPaneState,
  fromPath: string,
  toPath: string,
): EditorPaneState {
  if (fromPath === toPath) return pane;
  const fromIndex = pane.tabs.findIndex((tab) => tab.path === fromPath);
  const toIndex = pane.tabs.findIndex((tab) => tab.path === toPath);
  if (fromIndex < 0 || toIndex < 0) return pane;
  const tabs = [...pane.tabs];
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(toIndex, 0, moved);
  return { ...pane, tabs };
}

/** Move a tab from one pane into another (optionally before `beforePath`, else append). */
export function moveEditorTabBetweenPanes(
  fromPane: EditorPaneState,
  toPane: EditorPaneState,
  path: string,
  beforePath: string | null = null,
): { fromPane: EditorPaneState; toPane: EditorPaneState } {
  const tab = fromPane.tabs.find((item) => item.path === path);
  if (!tab) return { fromPane, toPane };

  const nextFrom = closeEditorTab(fromPane, path);

  // Already open in destination — just activate and remove from source.
  if (toPane.tabs.some((item) => item.path === path)) {
    return {
      fromPane: nextFrom,
      toPane: activateEditorTab(toPane, path),
    };
  }

  const tabs = [...toPane.tabs];
  if (beforePath) {
    const at = tabs.findIndex((item) => item.path === beforePath);
    if (at >= 0) tabs.splice(at, 0, tab);
    else tabs.push(tab);
  } else {
    tabs.push(tab);
  }

  return {
    fromPane: nextFrom,
    toPane: { tabs, activePath: path },
  };
}

export function activeEditorFile(pane: EditorPaneState): EditorTab | null {
  return pane.tabs.find((tab) => tab.path === pane.activePath) ?? null;
}
