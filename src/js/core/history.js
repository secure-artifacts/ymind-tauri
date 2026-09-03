import { state, getActiveTab } from "./state.js";
import { sanitizeTreeForHistory } from "./tree-utils.js";

export { sanitizeTreeForHistory };

export function saveSnapshot() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return;
  tab.isDirty = true;
  state.isLayoutDirty = true;

  if (!tab.history) { tab.history = []; tab.historyIndex = -1; }
  if (tab.historyIndex < tab.history.length - 1) {
    tab.history.splice(tab.historyIndex + 1);
  }
  tab.history.push(sanitizeTreeForHistory(tab.mindData));
  if (tab.history.length > 50) {
    tab.history.shift();
    tab.historyIndex = tab.history.length - 1;
  } else {
    tab.historyIndex++;
  }
}

export function undo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex <= 0) return;
  tab.historyIndex--;
  tab.mindData = sanitizeTreeForHistory(tab.history[tab.historyIndex]);
  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}

export function redo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  tab.mindData = sanitizeTreeForHistory(tab.history[tab.historyIndex]);
  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}
