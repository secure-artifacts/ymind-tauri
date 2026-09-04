import { scheduleSessionSave } from "../storage/session.js";
import { state, getActiveTab, findNode, findParent } from "./state.js";
import { sanitizeTreeForHistory } from "./tree-utils.js";

export { sanitizeTreeForHistory };

export const COMMANDS = {
  SET_TEXT: "SET_TEXT",
  INSERT_NODE: "INSERT_NODE",
  REMOVE_NODE: "REMOVE_NODE",
  MOVE_NODE: "MOVE_NODE",
  UPDATE_ATTRS: "UPDATE_ATTRS"
};

/**
 * 🌟 统一事件驱动事务流：无论是命令模式还是全量快照，统一归入单一线性流水线
 */
export function executeCommand(cmd, applyImmediately = true) {
  const tab = getActiveTab();
  if (!tab) return;
  if (!tab.historyStack) { tab.historyStack = []; tab.historyIndex = -1; }

  if (applyImmediately) {
    applyCmd(cmd, tab.mindData);
  }

  // 截断游标后的历史
  if (tab.historyIndex < tab.historyStack.length - 1) {
    tab.historyStack.splice(tab.historyIndex + 1);
  }

  tab.historyStack.push({ type: "COMMAND", payload: cmd });
  if (tab.historyStack.length > 80) {
    tab.historyStack.shift();
  } else {
    tab.historyIndex++;
  }

  tab.isDirty = true;
  state.isLayoutDirty = true;
  scheduleSessionSave();
}

export function saveSnapshot() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return;

  if (!tab.historyStack) { tab.historyStack = []; tab.historyIndex = -1; }

  if (tab.historyIndex < tab.historyStack.length - 1) {
    tab.historyStack.splice(tab.historyIndex + 1);
  }

  tab.historyStack.push({
    type: "SNAPSHOT",
    payload: sanitizeTreeForHistory(tab.mindData)
  });

  if (tab.historyStack.length > 50) {
    tab.historyStack.shift();
  } else {
    tab.historyIndex++;
  }

  tab.isDirty = true;
  state.isLayoutDirty = true;
  scheduleSessionSave();
}

export function undo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.historyStack || tab.historyIndex < 0) return;

  const currentRecord = tab.historyStack[tab.historyIndex];
  tab.historyIndex--;

  if (currentRecord.type === "COMMAND") {
    revertCmd(currentRecord.payload, tab.mindData);
  } else if (currentRecord.type === "SNAPSHOT") {
    // 寻找上一份有效快照或回滚基础
    let prevSnapshot = null;
    for (let i = tab.historyIndex; i >= 0; i--) {
      if (tab.historyStack[i].type === "SNAPSHOT") {
        prevSnapshot = tab.historyStack[i].payload;
        break;
      }
    }
    if (prevSnapshot) {
      tab.mindData = sanitizeTreeForHistory(prevSnapshot);
    }
  }

  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}

export function redo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.historyStack || tab.historyIndex >= tab.historyStack.length - 1) return;

  tab.historyIndex++;
  const record = tab.historyStack[tab.historyIndex];

  if (record.type === "COMMAND") {
    applyCmd(record.payload, tab.mindData);
  } else if (record.type === "SNAPSHOT") {
    tab.mindData = sanitizeTreeForHistory(record.payload);
  }

  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}

function applyCmd(cmd, root) {
  if (!cmd || !root) return;
  switch (cmd.type) {
    case COMMANDS.SET_TEXT: {
      const node = findNode(cmd.nodeId, root);
      if (node) node.text = cmd.newText;
      break;
    }
    case COMMANDS.INSERT_NODE: {
      const parent = findNode(cmd.parentId, root);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.splice(cmd.index, 0, cmd.node);
      }
      break;
    }
    case COMMANDS.REMOVE_NODE: {
      const parent = findParent(cmd.nodeId, root);
      if (parent) {
        parent.children = parent.children.filter(c => c.id !== cmd.nodeId);
      }
      break;
    }
    case COMMANDS.MOVE_NODE: {
      const oldP = findNode(cmd.fromParentId, root);
      const newP = findNode(cmd.toParentId, root);
      if (oldP && newP) {
        const n = oldP.children.splice(cmd.fromIndex, 1)[0];
        if (n) {
          if (!newP.children) newP.children = [];
          newP.children.splice(cmd.toIndex, 0, n);
        }
      }
      break;
    }
    case COMMANDS.UPDATE_ATTRS: {
      const node = findNode(cmd.nodeId, root);
      if (node) Object.assign(node, cmd.newAttrs);
      break;
    }
  }
}

function revertCmd(cmd, root) {
  if (!cmd || !root) return;
  switch (cmd.type) {
    case COMMANDS.SET_TEXT: {
      const node = findNode(cmd.nodeId, root);
      if (node) node.text = cmd.oldText;
      break;
    }
    case COMMANDS.INSERT_NODE: {
      const parent = findNode(cmd.parentId, root);
      if (parent) {
        parent.children = parent.children.filter(c => c.id !== cmd.node.id);
      }
      break;
    }
    case COMMANDS.REMOVE_NODE: {
      const parent = findNode(cmd.oldParentId, root);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.splice(cmd.oldIndex, 0, cmd.oldNode);
      }
      break;
    }
    case COMMANDS.MOVE_NODE: {
      const oldP = findNode(cmd.toParentId, root);
      const origP = findNode(cmd.fromParentId, root);
      if (oldP && origP) {
        const n = oldP.children.splice(cmd.toIndex, 1)[0];
        if (n) {
          if (!origP.children) origP.children = [];
          origP.children.splice(cmd.fromIndex, 0, n);
        }
      }
      break;
    }
    case COMMANDS.UPDATE_ATTRS: {
      const node = findNode(cmd.nodeId, root);
      if (node) Object.assign(node, cmd.oldAttrs);
      break;
    }
  }
}
