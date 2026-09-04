import { state, getAncestors, findNode } from "../core/state.js";
import { ensureNodeVisible } from "../core/camera.js";
import { bus, EVENTS } from "../core/event-bus.js";

let matchedNodeIds = [];
let currentMatchIndex = -1;

const searchBar = document.getElementById("apple-search-bar");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const btnSearchPrev = document.getElementById("btn-search-prev");
const btnSearchNext = document.getElementById("btn-search-next");
const btnSearchClose = document.getElementById("btn-search-close");

export function openSearch() {
  if (!searchBar) return;
  searchBar.classList.remove("hidden");
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
  performSearch();
}

export function closeSearch() {
  if (!searchBar) return;
  searchBar.classList.add("hidden");
  matchedNodeIds = [];
  currentMatchIndex = -1;
  if (searchInput) searchInput.blur();
}

export function isSearchOpen() {
  return Boolean(searchBar && !searchBar.classList.contains("hidden"));
}

function performSearch() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  matchedNodeIds = [];
  currentMatchIndex = -1;

  if (!query) {
    if (searchCount) searchCount.innerText = "0 / 0";
    return;
  }

  function searchTree(node) {
    if (!node) return;
    const matchText = node.text && String(node.text).toLowerCase().includes(query);
    const matchPriority = node.priority && String(node.priority).toLowerCase().includes(query);
    const matchTag = Array.isArray(node.tags) && node.tags.some(t => String(t).toLowerCase().includes(query));
    const matchNote = node.note && String(node.note).toLowerCase().includes(query);

    if (matchText || matchPriority || matchTag || matchNote) {
      matchedNodeIds.push(node.id);
    }

    if (node.children) node.children.forEach(searchTree);
  }

  searchTree(state.mindData);

  if (matchedNodeIds.length > 0) {
    currentMatchIndex = 0;
    updateSearchCount();
    focusCurrentMatch();
  } else {
    if (searchCount) searchCount.innerText = "0 / 0";
  }
}

function updateSearchCount() {
  if (searchCount) {
    searchCount.innerText = `${currentMatchIndex + 1} / ${matchedNodeIds.length}`;
  }
}

function focusCurrentMatch() {
  if (currentMatchIndex >= 0 && currentMatchIndex < matchedNodeIds.length) {
    const targetId = matchedNodeIds[currentMatchIndex];
    // 自动沿途展开父级折叠节点
    const ancestors = getAncestors(targetId, state.mindData);
    if (ancestors) {
      ancestors.forEach(a => {
        if (a.id !== targetId && a.collapsed) {
          a.collapsed = false;
          state.isLayoutDirty = true;
        }
      });
    }

    state.selectedIds = new Set([targetId]);
    bus.emit(EVENTS.RENDER_APP);

    const node = findNode(targetId, state.mindData);
    if (node) ensureNodeVisible(node, true);
  }
}

function goToNext() {
  if (matchedNodeIds.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % matchedNodeIds.length;
  updateSearchCount();
  focusCurrentMatch();
}

function goToPrev() {
  if (matchedNodeIds.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + matchedNodeIds.length) % matchedNodeIds.length;
  updateSearchCount();
  focusCurrentMatch();
}

export function initSearchEngine(renderApp) {
  let searchDebounceTimer = null;
  if (searchInput) {
    searchInput.oninput = () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        performSearch();
      }, 160);
    };
    searchInput.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goToPrev();
        else goToNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
    };
  }

  if (btnSearchNext) btnSearchNext.onclick = (e) => { e.stopPropagation(); goToNext(); };
  if (btnSearchPrev) btnSearchPrev.onclick = (e) => { e.stopPropagation(); goToPrev(); };
  if (btnSearchClose) btnSearchClose.onclick = (e) => { e.stopPropagation(); closeSearch(); };

  document.getElementById("btn-search-toggle")?.addEventListener("click", () => {
    if (isSearchOpen()) closeSearch();
    else openSearch();
  });
}
