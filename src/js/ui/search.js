import { state, getAncestors, findNode } from "../core/state.js";
import { ensureNodeVisible } from "../core/camera.js";

let matchedNodeIds = [];
let currentMatchIndex = -1;

const searchBar = document.getElementById("apple-search-bar");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const btnSearchPrev = document.getElementById("btn-search-prev");
const btnSearchNext = document.getElementById("btn-search-next");
const btnSearchClose = document.getElementById("btn-search-close");

export function initSearchEngine(renderApp) {
  function openSearch() {
    searchBar?.classList.remove("hidden");
    searchInput?.focus();
    searchInput?.select();
    performSearch();
  }

  function closeSearch() {
    searchBar?.classList.add("hidden");
    matchedNodeIds = [];
    currentMatchIndex = -1;
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
    if (searchCount) searchCount.innerText = `${currentMatchIndex + 1} / ${matchedNodeIds.length}`;
  }

  function focusCurrentMatch() {
    if (currentMatchIndex >= 0 && currentMatchIndex < matchedNodeIds.length) {
      const targetId = matchedNodeIds[currentMatchIndex];
      const ancestors = getAncestors(targetId, state.mindData);
      if (ancestors) ancestors.forEach(a => { if (a.id !== targetId) a.collapsed = false; });
      state.selectedIds = new Set([targetId]);
      renderApp();
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

  if (searchInput) {
    searchInput.oninput = performSearch;
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goToPrev();
        else goToNext();
      } else if (e.key === "Escape") {
        closeSearch();
      }
    };
  }

  if (btnSearchNext) btnSearchNext.onclick = goToNext;
  if (btnSearchPrev) btnSearchPrev.onclick = goToPrev;
  if (btnSearchClose) btnSearchClose.onclick = closeSearch;

  document.getElementById("btn-search-toggle")?.addEventListener("click", openSearch);

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openSearch();
    }
  });
}
