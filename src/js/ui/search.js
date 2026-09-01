import { state, getAncestors } from "../core/state.js";
import { smartCenterOnSelectedNode } from "../core/camera.js";

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
    searchBar.classList.remove("hidden");
    searchInput.focus();
    searchInput.select();
    performSearch();
  }

  function closeSearch() {
    searchBar.classList.add("hidden");
    matchedNodeIds = [];
    currentMatchIndex = -1;
    document.querySelectorAll(".svg-node").forEach(el => el.classList.remove("search-matched"));
  }

  function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    matchedNodeIds = [];
    currentMatchIndex = -1;

    document.querySelectorAll(".svg-node").forEach(el => el.classList.remove("search-matched"));

    if (!query) {
      searchCount.innerText = "0 / 0";
      return;
    }

    function searchTree(node) {
      const matchText = node.text && node.text.toLowerCase().includes(query);
      const matchPriority = node.priority && node.priority.toLowerCase().includes(query);
      const matchTag = node.tags && node.tags.some(t => t.toLowerCase().includes(query));
      const matchNote = node.note && node.note.toLowerCase().includes(query);

      if (matchText || matchPriority || matchTag || matchNote) {
        matchedNodeIds.push(node.id);
        const dom = document.querySelector(`.svg-node[data-id="${node.id}"]`);
        if (dom) dom.classList.add("search-matched");
      }

      if (node.children) node.children.forEach(searchTree);
    }

    searchTree(state.mindData);

    if (matchedNodeIds.length > 0) {
      currentMatchIndex = 0;
      updateSearchCount();
      focusCurrentMatch();
    } else {
      searchCount.innerText = "0 / 0";
    }
  }

  function updateSearchCount() {
    searchCount.innerText = `${currentMatchIndex + 1} / ${matchedNodeIds.length}`;
  }

  function focusCurrentMatch() {
    if (currentMatchIndex >= 0 && currentMatchIndex < matchedNodeIds.length) {
      const targetId = matchedNodeIds[currentMatchIndex];
      const ancestors = getAncestors(targetId, state.mindData);
      if (ancestors) ancestors.forEach(a => { if (a.id !== targetId) a.collapsed = false; });
      state.selectedIds = new Set([targetId]);
      renderApp();
      smartCenterOnSelectedNode(state, true);
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

  btnSearchNext.onclick = goToNext;
  btnSearchPrev.onclick = goToPrev;
  btnSearchClose.onclick = closeSearch;

  document.getElementById("btn-search-toggle").onclick = openSearch;

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openSearch();
    }
  });
}
