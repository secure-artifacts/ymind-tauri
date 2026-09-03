import { state, getAncestors } from "../core/state.js";
import { showToast } from "./dialog.js";

let cardDeck = [];
let currentCardIndex = 0;
let stats = { mastered: 0, review: 0, forgot: 0 };

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

export function toggleRecallMode(renderApp) {
  state.isRecallMode = !state.isRecallMode;
  const btn = document.getElementById("btn-active-recall");
  if (btn) btn.classList.toggle("active-mode", !!state.isRecallMode);
  showToast(state.isRecallMode ? "🎭 记忆测试掩码已开启：点击遮罩节点可即时揭晓" : "👁️ 已退出记忆测试模式");
  renderApp();
}

export function initFlashcards(renderApp) {
  const modal = document.getElementById("apple-flashcards-modal");
  const cardContainer = document.getElementById("flashcard-3d-wrap");
  const btnClose = document.getElementById("btn-close-flashcards");
  const btnFlip = document.getElementById("btn-flip-card");
  const btnPrev = document.getElementById("btn-card-prev");
  const btnNext = document.getElementById("btn-card-next");

  btnClose?.addEventListener("click", closeFlashcardModal);
  btnFlip?.addEventListener("click", flipCard);
  cardContainer?.addEventListener("click", flipCard);

  btnPrev?.addEventListener("click", () => navigateCard(-1));
  btnNext?.addEventListener("click", () => navigateCard(1));

  document.getElementById("btn-rate-forgot")?.addEventListener("click", () => rateCard("forgot"));
  document.getElementById("btn-rate-review")?.addEventListener("click", () => rateCard("review"));
  document.getElementById("btn-rate-mastered")?.addEventListener("click", () => rateCard("mastered"));

  window.addEventListener("keydown", (e) => {
    if (!modal || modal.classList.contains("hidden")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipCard(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); navigateCard(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); navigateCard(1); }
    else if (e.key === "1") rateCard("forgot");
    else if (e.key === "2") rateCard("review");
    else if (e.key === "3") rateCard("mastered");
    else if (e.key === "Escape") closeFlashcardModal();
  });
}

export function openFlashcardModal() {
  const modal = document.getElementById("apple-flashcards-modal");
  if (!modal) return;

  cardDeck = buildFlashcardDeck(state.mindData);
  if (cardDeck.length === 0) {
    showToast("⚠️ 当前导图没有足够的分支节点可供生成抽认卡");
    return;
  }

  currentCardIndex = 0;
  stats = { mastered: 0, review: 0, forgot: 0 };
  modal.classList.remove("hidden");
  renderCurrentCard();
}

export function closeFlashcardModal() {
  document.getElementById("apple-flashcards-modal")?.classList.add("hidden");
}

function buildFlashcardDeck(rootNode) {
  const deck = [];
  function scan(node, parentPath = []) {
    if (!node) return;
    const currentPath = [...parentPath, node.text];
    if ((node.children && node.children.length > 0) || node.note) {
      deck.push({
        id: node.id,
        title: node.text,
        icon: node.icon || "",
        priority: node.priority || "",
        path: parentPath.join(" › ") || "核心主题",
        children: (node.children || []).map(c => c.text),
        note: node.note || ""
      });
    }
    if (node.children) node.children.forEach(c => scan(c, currentPath));
  }
  scan(rootNode, []);
  return deck;
}

function renderCurrentCard() {
  const card = cardDeck[currentCardIndex];
  const cardWrap = document.getElementById("flashcard-3d-wrap");
  const progressText = document.getElementById("flashcard-progress-text");
  const progressBar = document.getElementById("flashcard-progress-bar");
  if (!card || !cardWrap) return;

  cardWrap.classList.remove("is-flipped");

  document.getElementById("card-front-path").innerText = card.path;
  document.getElementById("card-front-title").innerText = (card.icon ? card.icon + " " : "") + card.title;
  document.getElementById("card-front-hint").innerText = card.children.length > 0 
    ? `💡 请在脑海中回想此主题下的 ${card.children.length} 个子要点及核心细节...` 
    : "💡 请回想此节点的详细备注与背景信息...";

  document.getElementById("card-back-title").innerText = (card.icon ? card.icon + " " : "") + card.title;
  
  let backAnswerHtml = "";
  if (card.children.length > 0) {
    backAnswerHtml += "<ul class=\"card-answer-list\">" + card.children.map(c => `<li>${escapeHtml(c)}</li>`).join("") + "</ul>";
  }
  if (card.note) {
    const safeNote = escapeHtml(card.note).replace(/\n/g, "<br/>");
    backAnswerHtml += `<div class="card-answer-note"><div class="card-note-badge">📝 详细备注</div>${safeNote}</div>`;
  }
  document.getElementById("card-back-answers").innerHTML = backAnswerHtml;

  if (progressText) progressText.innerText = `${currentCardIndex + 1} / ${cardDeck.length}`;
  if (progressBar) progressBar.style.width = `${((currentCardIndex + 1) / cardDeck.length) * 100}%`;
}

function flipCard() {
  document.getElementById("flashcard-3d-wrap")?.classList.toggle("is-flipped");
}

function navigateCard(delta) {
  currentCardIndex = (currentCardIndex + delta + cardDeck.length) % cardDeck.length;
  renderCurrentCard();
}

function rateCard(type) {
  stats[type]++;
  if (currentCardIndex < cardDeck.length - 1) {
    currentCardIndex++;
    renderCurrentCard();
  } else {
    showToast(`🎉 恭喜完成本轮复习！掌握: ${stats.mastered}，待巩固: ${stats.review}，重背: ${stats.forgot}`);
    closeFlashcardModal();
  }
}
