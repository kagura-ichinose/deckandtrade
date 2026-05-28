const CONFIG = {
  dataUrl: "data/decks.json",
  apiEndpoint: "",
  ...(window.DECK_LEDGER_CONFIG || {})
};

const fallbackDecks = [
  {
    id: "deck-gardy",
    name: "サーナイトex",
    regulation: "スタンダード",
    memo: "安定感を重視したリスト。入れ替え候補はナンジャモの枚数とACE SPEC枠。",
    updatedAt: "2026-05-20T09:00:00.000Z",
    references: [
      { title: "note: シティリーグ入賞構築", url: "https://note.com/" },
      { title: "大会ログ", url: "https://example.com/" }
    ],
    cards: [
      { name: "サーナイトex", required: 2, owned: 2, price: 650 },
      { name: "キルリア", required: 4, owned: 4, price: 180 },
      { name: "ラルトス", required: 4, owned: 3, price: 120 },
      { name: "ナンジャモ", required: 3, owned: 2, price: 900 },
      { name: "ボスの指令", required: 2, owned: 2, price: 160 }
    ]
  },
  {
    id: "deck-miraidon",
    name: "ミライドンex",
    regulation: "スタンダード",
    memo: "スピード重視。雷エネルギーの枚数とサブアタッカーを調整中。",
    updatedAt: "2026-05-18T11:30:00.000Z",
    references: [{ title: "note: 環境考察", url: "https://note.com/" }],
    cards: [
      { name: "ミライドンex", required: 2, owned: 1, price: 580 },
      { name: "テツノカイナex", required: 2, owned: 2, price: 780 },
      { name: "ジェネレーター", required: 4, owned: 4, price: 110 },
      { name: "森の封印石", required: 1, owned: 0, price: 450 },
      { name: "雷エネルギー", required: 12, owned: 16, price: 30 }
    ]
  },
  {
    id: "deck-darkbox",
    name: "悪バレット",
    regulation: "エクストラ",
    memo: "複数の勝ち筋を持てるが、グッズ配分をもう少し詰めたい。",
    updatedAt: "2026-05-12T15:20:00.000Z",
    references: [
      { title: "デッキ解説", url: "https://example.com/" },
      { title: "対戦メモ", url: "" }
    ],
    cards: [
      { name: "ダークライGX", required: 2, owned: 2, price: 420 },
      { name: "ダークパッチ", required: 4, owned: 2, price: 260 },
      { name: "バトルサーチャー", required: 4, owned: 4, price: 350 },
      { name: "かるいし", required: 2, owned: 1, price: 290 },
      { name: "悪エネルギー", required: 10, owned: 12, price: 30 }
    ]
  }
];

const state = {
  decks: [],
  activeRegulation: "すべて",
  editingId: null,
  editPassword: "",
  editorVerified: false,
  toastTimer: null,
  isSaving: false
};

const elements = {
  deckCount: document.querySelector("#deckCount"),
  ownedCount: document.querySelector("#ownedCount"),
  ownedValue: document.querySelector("#ownedValue"),
  missingValue: document.querySelector("#missingValue"),
  regulationTabs: document.querySelector("#regulationTabs"),
  deckGrid: document.querySelector("#deckGrid"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  newDeckButton: document.querySelector("#newDeckButton"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  importButton: document.querySelector("#importButton"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  editPassword: document.querySelector("#editPassword"),
  unlockButton: document.querySelector("#unlockButton"),
  refreshButton: document.querySelector("#refreshButton"),
  publishStatus: document.querySelector("#publishStatus"),
  dialog: document.querySelector("#deckDialog"),
  form: document.querySelector("#deckForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelButton: document.querySelector("#cancelButton"),
  saveDeckButton: document.querySelector("#saveDeckButton"),
  deleteDeckButton: document.querySelector("#deleteDeckButton"),
  deckName: document.querySelector("#deckName"),
  deckRegulation: document.querySelector("#deckRegulation"),
  deckMemo: document.querySelector("#deckMemo"),
  regulationList: document.querySelector("#regulationList"),
  addCardButton: document.querySelector("#addCardButton"),
  cardRows: document.querySelector("#cardRows"),
  addReferenceButton: document.querySelector("#addReferenceButton"),
  referenceRows: document.querySelector("#referenceRows"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  bindEvents();
  await loadPublishedDecks();
  updateEditorState();
}

function bindEvents() {
  elements.newDeckButton.addEventListener("click", () => openEditor());
  elements.emptyAddButton.addEventListener("click", () => openEditor());
  elements.closeDialogButton.addEventListener("click", closeEditor);
  elements.cancelButton.addEventListener("click", closeEditor);
  elements.form.addEventListener("submit", saveCurrentDeck);
  elements.deleteDeckButton.addEventListener("click", deleteCurrentDeck);
  elements.addCardButton.addEventListener("click", () => elements.cardRows.append(createCardRow(blankCard())));
  elements.addReferenceButton.addEventListener("click", () => elements.referenceRows.append(createReferenceRow(blankReference())));
  elements.searchInput.addEventListener("input", renderDecks);
  elements.sortSelect.addEventListener("change", renderDecks);
  elements.exportButton.addEventListener("click", exportDecks);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", (event) => importDecks(event.target.files[0]));
  elements.editPassword.addEventListener("input", handlePasswordInput);
  elements.unlockButton.addEventListener("click", verifyPassword);
  elements.refreshButton.addEventListener("click", loadPublishedDecks);
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeEditor();
    }
  });
}

async function loadPublishedDecks() {
  setPublishStatus("読み込み中", "neutral");

  try {
    const response = await fetch(`${CONFIG.dataUrl}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Deck data could not be loaded.");
    }
    const data = await response.json();
    const decks = Array.isArray(data) ? data : data.decks;
    state.decks = normalizeDecks(decks);
    render();
    setPublishStatus(state.editorVerified ? "編集可" : "未確認", state.editorVerified ? "ready" : "neutral");
  } catch {
    state.decks = normalizeDecks(fallbackDecks);
    render();
    setPublishStatus("読込失敗", "error");
    showToast("公開データを読み込めませんでした。サンプルを表示しています。");
  }
}

function normalizeDecks(decks) {
  if (!Array.isArray(decks)) {
    return [];
  }

  return decks.map((deck) => ({
    id: deck.id || crypto.randomUUID(),
    name: deck.name || "無題のデッキ",
    regulation: deck.regulation || "未分類",
    memo: deck.memo || "",
    showCardList: deck.showCardList === true,
    cardListImageUrl: deck.cardListImageUrl || "",
    updatedAt: deck.updatedAt || new Date().toISOString(),
    references: Array.isArray(deck.references) ? deck.references.map((reference) => ({
      title: reference.title || "",
      url: reference.url || ""
    })) : [],
    cards: Array.isArray(deck.cards) ? deck.cards.map((card) => ({
      name: card.name || "",
      required: Number(card.required) || 0,
      owned: Number(card.owned) || 0,
      price: Number(card.price) || 0
    })) : []
  }));
}

function handlePasswordInput() {
  state.editPassword = elements.editPassword.value;
  state.editorVerified = false;
  updateEditorState();
}

async function verifyPassword() {
  if (!CONFIG.apiEndpoint) {
    setPublishStatus("API未設定", "error");
    showToast("site.config.js に保存APIのURLを設定してください。");
    return;
  }

  if (!state.editPassword) {
    setPublishStatus("未入力", "error");
    showToast("編集パスワードを入力してください。");
    return;
  }

  setPublishStatus("確認中", "neutral");
  elements.unlockButton.disabled = true;

  try {
    await callSaveApi({ mode: "verify", password: state.editPassword });
    state.editorVerified = true;
    updateEditorState();
    showToast("編集できる状態になりました。");
  } catch (error) {
    state.editorVerified = false;
    updateEditorState("error");
    showToast(error.message || "パスワードを確認できませんでした。");
  } finally {
    elements.unlockButton.disabled = false;
  }
}

function updateEditorState(kind = state.editorVerified ? "ready" : "neutral") {
  const canEdit = state.editorVerified;
  elements.newDeckButton.disabled = !canEdit;
  elements.emptyAddButton.disabled = !canEdit;
  elements.importButton.disabled = !canEdit;
  elements.saveDeckButton.disabled = state.isSaving || !canEdit;
  elements.deleteDeckButton.disabled = state.isSaving || !canEdit;
  setPublishStatus(canEdit ? "編集可" : "未確認", kind);
  renderDecks();
}

function setPublishStatus(text, kind) {
  elements.publishStatus.textContent = text;
  elements.publishStatus.classList.toggle("is-ready", kind === "ready");
  elements.publishStatus.classList.toggle("is-error", kind === "error");
}

async function publishDecks(nextDecks, successMessage) {
  if (!CONFIG.apiEndpoint) {
    showToast("保存APIのURLが未設定です。");
    return false;
  }

  if (!state.editorVerified || !state.editPassword) {
    showToast("編集パスワードを確認してください。");
    return false;
  }

  state.isSaving = true;
  updateEditorState();
  setPublishStatus("保存中", "neutral");

  try {
    await callSaveApi({
      mode: "save",
      password: state.editPassword,
      decks: nextDecks
    });
    state.decks = nextDecks;
    render();
    setPublishStatus("編集可", "ready");
    showToast(successMessage || "GitHubに保存しました。反映まで少し待ってください。");
    return true;
  } catch (error) {
    setPublishStatus("保存失敗", "error");
    showToast(error.message || "保存できませんでした。");
    return false;
  } finally {
    state.isSaving = false;
    updateEditorState(state.editorVerified ? "ready" : "neutral");
  }
}

async function callSaveApi(payload) {
  const response = await fetch(CONFIG.apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "APIからエラーが返りました。");
  }

  return data;
}

function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Math.max(0, value || 0));
}

function number(value) {
  return new Intl.NumberFormat("ja-JP").format(Math.max(0, value || 0));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sum(deck, mapper) {
  return deck.cards.reduce((total, card) => total + mapper(card), 0);
}

function deckStats(deck) {
  const required = sum(deck, (card) => Number(card.required) || 0);
  const owned = sum(deck, (card) => Math.min(Number(card.owned) || 0, Number(card.required) || 0));
  const totalOwned = sum(deck, (card) => Number(card.owned) || 0);
  const ownedValue = sum(deck, (card) => (Number(card.owned) || 0) * (Number(card.price) || 0));
  const deckValue = sum(deck, (card) => (Number(card.required) || 0) * (Number(card.price) || 0));
  const missingValue = sum(deck, (card) => Math.max((Number(card.required) || 0) - (Number(card.owned) || 0), 0) * (Number(card.price) || 0));
  const completion = required === 0 ? 0 : Math.round((owned / required) * 100);

  return {
    required,
    owned,
    totalOwned,
    ownedValue,
    deckValue,
    missingValue,
    completion: clamp(completion, 0, 100)
  };
}

function allRegulations() {
  const values = state.decks.map((deck) => deck.regulation).filter(Boolean);
  return ["すべて", ...new Set(values)];
}

function filteredDecks() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const byRegulation = state.activeRegulation === "すべて"
    ? state.decks
    : state.decks.filter((deck) => deck.regulation === state.activeRegulation);

  const byQuery = query
    ? byRegulation.filter((deck) => {
      const haystack = [
        deck.name,
        deck.regulation,
        deck.memo,
        ...deck.cards.map((card) => card.name),
        ...deck.references.flatMap((reference) => [reference.title, reference.url])
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    : byRegulation;

  return [...byQuery].sort((a, b) => {
    const aStats = deckStats(a);
    const bStats = deckStats(b);

    if (elements.sortSelect.value === "value") {
      return bStats.ownedValue - aStats.ownedValue;
    }
    if (elements.sortSelect.value === "missing") {
      return bStats.missingValue - aStats.missingValue;
    }
    if (elements.sortSelect.value === "complete") {
      return bStats.completion - aStats.completion;
    }
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function render() {
  renderSummary();
  renderRegulations();
  renderDecks();
  updateRegulationDatalist();
}

function renderSummary() {
  const totals = state.decks.reduce((acc, deck) => {
    const stats = deckStats(deck);
    acc.ownedCount += stats.totalOwned;
    acc.ownedValue += stats.ownedValue;
    acc.missingValue += stats.missingValue;
    return acc;
  }, { ownedCount: 0, ownedValue: 0, missingValue: 0 });

  elements.deckCount.textContent = number(state.decks.length);
  elements.ownedCount.textContent = number(totals.ownedCount);
  elements.ownedValue.textContent = yen(totals.ownedValue);
  elements.missingValue.textContent = yen(totals.missingValue);
}

function renderRegulations() {
  elements.regulationTabs.replaceChildren(...allRegulations().map((regulation) => {
    const button = document.createElement("button");
    const count = regulation === "すべて"
      ? state.decks.length
      : state.decks.filter((deck) => deck.regulation === regulation).length;

    button.className = "tab-button";
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(state.activeRegulation === regulation));
    button.textContent = `${regulation} ${count}`;
    button.addEventListener("click", () => {
      state.activeRegulation = regulation;
      render();
    });
    return button;
  }));
}

function renderDecks() {
  const decks = filteredDecks();
  elements.deckGrid.replaceChildren(...decks.map(createDeckCard));
  elements.emptyState.hidden = decks.length > 0;
}

function createDeckCard(deck) {
  const stats = deckStats(deck);
  const article = document.createElement("article");
  article.className = "deck-card";

  const header = document.createElement("div");
  header.className = "deck-card-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "deck-title-wrap";
  titleWrap.innerHTML = `
    <span class="regulation-badge"></span>
    <h3></h3>
  `;
  titleWrap.querySelector(".regulation-badge").textContent = deck.regulation;
  titleWrap.querySelector("h3").textContent = deck.name;

  const editButton = document.createElement("button");
  editButton.className = "icon-button deck-menu";
  editButton.type = "button";
  editButton.title = state.editorVerified ? "編集" : "編集ロック中";
  editButton.setAttribute("aria-label", `${deck.name}を編集`);
  editButton.disabled = !state.editorVerified;
  editButton.textContent = "✎";
  editButton.addEventListener("click", () => openEditor(deck.id));

  header.append(titleWrap, editButton);

  const body = document.createElement("div");
  body.className = "deck-body";
  body.append(
    createProgress(stats),
    createStats(stats),
    createCardListButton(deck),
    function showCardListModal(title, list, imageUrl) {
  const overlay = document.createElement("div");
  overlay.className = "card-list-modal-overlay";

  overlay.innerHTML = `
    <div class="card-list-modal">
      <div class="card-list-modal-header">
        <h2></h2>
        <button type="button" class="icon-button card-list-modal-close">×</button>
      </div>
      <pre class="card-list-modal-text"></pre>
      ${
        imageUrl
          ? `<img class="card-list-modal-image" src="${imageUrl}" alt="カードリスト画像">`
          : ""
      }
    </div>
  `;

  overlay.querySelector("h2").textContent = title;
  overlay.querySelector(".card-list-modal-text").textContent =
    list || "カードリストがありません。";

  overlay.querySelector(".card-list-modal-close").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document.body.append(overlay);
}
    createMemo(deck.memo),
    createReferences(deck.references)
  );

  const footer = document.createElement("div");
  footer.className = "deck-footer";
  footer.innerHTML = `
    <span></span>
    <button class="secondary-button" type="button">詳細編集</button>
  `;
  footer.querySelector("span").textContent = `更新 ${formatDate(deck.updatedAt)}`;
  const footerButton = footer.querySelector("button");
  footerButton.disabled = !state.editorVerified;
  footerButton.textContent = state.editorVerified ? "詳細編集" : "編集ロック中";
  footerButton.addEventListener("click", () => openEditor(deck.id));

  article.append(header, body, footer);
  return article;
}

function createProgress(stats) {
  const wrap = document.createElement("div");
  wrap.className = "progress-wrap";
  wrap.innerHTML = `
    <div class="progress-label">
      <span>完成度</span>
      <strong></strong>
    </div>
    <div class="progress-bar" aria-hidden="true"><span></span></div>
  `;
  wrap.querySelector("strong").textContent = `${stats.completion}%`;
  wrap.querySelector(".progress-bar").style.setProperty("--progress", `${stats.completion}%`);
  return wrap;
}

function createStats(stats) {
  const statsWrap = document.createElement("div");
  statsWrap.className = "deck-stats";

  [
    ["所持", `${number(stats.owned)} / ${number(stats.required)}`],
    ["資産", yen(stats.ownedValue)],
    ["不足", yen(stats.missingValue)]
  ].forEach(([label, value]) => {
    const stat = document.createElement("div");
    stat.className = "stat-box";
    stat.innerHTML = "<span></span><strong></strong>";
    stat.querySelector("span").textContent = label;
    stat.querySelector("strong").textContent = value;
    statsWrap.append(stat);
  });

  return statsWrap;
}

function createCardListButton(deck) {
  const wrap = document.createElement("div");
  wrap.className = "card-list-area";

  if (!deck.showCardList) {
    return wrap;
  }

  const button = document.createElement("button");
  button.className = "secondary-button card-list-button";
  button.type = "button";
  button.textContent = "カードリストを見る";

  button.addEventListener("click", () => {
    const list = deck.cards
      .filter((card) => card.name)
      .map((card) => `${card.name} ×${card.required}`)
      .join("\n");

    const imageUrl = deck.cardListImageUrl || "";

const html = `
<div style="max-height:70vh;overflow:auto;">
  <pre style="white-space:pre-wrap;font-size:14px;">${list}</pre>
  ${
    imageUrl
      ? `<img src="${imageUrl}" style="width:100%;margin-top:12px;border-radius:8px;">`
      : ""
  }
</div>
`;

showCardListModal(deck.name, list, imageUrl);
  });

  wrap.append(button);
  return wrap;
}

function createMemo(memo) {
  const paragraph = document.createElement("p");
  paragraph.className = "memo-text";
  paragraph.textContent = memo || "メモなし";
  return paragraph;
}

function createReferences(references) {
  const wrap = document.createElement("div");
  wrap.className = "reference-chips";

  const visibleReferences = references.filter((reference) => reference.title || reference.url);
  if (visibleReferences.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "参考リンクなし";
    wrap.append(empty);
    return wrap;
  }

  visibleReferences.slice(0, 3).forEach((reference) => {
    const label = reference.title || reference.url;
    if (reference.url) {
      const link = document.createElement("a");
      link.href = reference.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      wrap.append(link);
    } else {
      const chip = document.createElement("span");
      chip.textContent = label;
      wrap.append(chip);
    }
  });

  if (visibleReferences.length > 3) {
    const extra = document.createElement("span");
    extra.textContent = `他${visibleReferences.length - 3}件`;
    wrap.append(extra);
  }

  return wrap;
}

function formatDate(value) {
  if (!value) {
    return "未設定";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function updateRegulationDatalist() {
  const options = allRegulations()
    .filter((regulation) => regulation !== "すべて")
    .map((regulation) => {
      const option = document.createElement("option");
      option.value = regulation;
      return option;
    });
  elements.regulationList.replaceChildren(...options);
}

function openEditor(deckId) {
  if (!state.editorVerified) {
    showToast("編集パスワードを確認してください。");
    return;
  }

  const deck = deckId ? state.decks.find((item) => item.id === deckId) : null;
  state.editingId = deck?.id || null;
  elements.dialogTitle.textContent = deck ? "デッキを編集" : "デッキを追加";
  elements.deleteDeckButton.hidden = !deck;
  elements.deckName.value = deck?.name || "";
  elements.deckRegulation.value = deck?.regulation || state.activeRegulation.replace("すべて", "") || "スタンダード";
  elements.deckMemo.value = deck?.memo || "";
  
  ensureShowCardListControl();
  document.querySelector("#showCardList").checked = deck?.showCardList === true;

  document.querySelector("#cardListImageUrl").value = deck?.cardListImageUrl || "";
  
  elements.cardRows.replaceChildren(...(deck?.cards?.length ? deck.cards : [blankCard()]).map(createCardRow));
  elements.referenceRows.replaceChildren(...(deck?.references?.length ? deck.references : [blankReference()]).map(createReferenceRow));
  elements.dialog.showModal();
  elements.deckName.focus();
}

function ensureShowCardListControl() {
  if (document.querySelector("#showCardList")) {
    return;
  }

  const label = document.createElement("label");
  label.className = "public-setting";

  label.innerHTML = `
    <span>公開設定</span>
    <label class="checkbox-row">
      <input id="showCardList" type="checkbox">
      カードリストを公開する
      </lavel>
      <label class="public-setting">
        <span>カードリスト画像URL</span>
        <input id="cardListImageUrl" type="url" placeholder="https://...">
      </label>
  `;

  elements.deckMemo.closest("label").after(label);
}

function closeEditor() {
  elements.dialog.close();
  elements.form.reset();
  state.editingId = null;
}

function blankCard() {
  return { name: "", required: 1, owned: 0, price: 0 };
}

function blankReference() {
  return { title: "", url: "" };
}

function createCardRow(card) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input data-field="name" type="text" placeholder="カード名"></td>
    <td><input class="number-input" data-field="required" type="number" min="0" max="99"></td>
    <td><input class="number-input" data-field="owned" type="number" min="0" max="999"></td>
    <td><input class="number-input" data-field="price" type="number" min="0" step="10" placeholder="円"></td>
    <td><button class="icon-button" type="button" title="行を削除" aria-label="行を削除">×</button></td>
  `;
  row.querySelector('[data-field="name"]').value = card.name || "";
  row.querySelector('[data-field="required"]').value = Number(card.required) || 0;
  row.querySelector('[data-field="owned"]').value = Number(card.owned) || 0;
  row.querySelector('[data-field="price"]').value = Number(card.price) || 0;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    ensureAtLeastOneCardRow();
  });
  return row;
}

function createReferenceRow(reference) {
  const row = document.createElement("div");
  row.className = "reference-row";
  row.innerHTML = `
    <input data-field="title" type="text" placeholder="表示名">
    <input data-field="url" type="url" placeholder="https://">
    <button class="icon-button" type="button" title="リンクを削除" aria-label="リンクを削除">×</button>
  `;
  row.querySelector('[data-field="title"]').value = reference.title || "";
  row.querySelector('[data-field="url"]').value = reference.url || "";
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    ensureAtLeastOneReferenceRow();
  });
  return row;
}

function ensureAtLeastOneCardRow() {
  if (elements.cardRows.children.length === 0) {
    elements.cardRows.append(createCardRow(blankCard()));
  }
}

function ensureAtLeastOneReferenceRow() {
  if (elements.referenceRows.children.length === 0) {
    elements.referenceRows.append(createReferenceRow(blankReference()));
  }
}

function collectFormDeck() {
  const cards = [...elements.cardRows.querySelectorAll("tr")]
    .map((row) => ({
      name: row.querySelector('[data-field="name"]').value.trim(),
      required: Number(row.querySelector('[data-field="required"]').value) || 0,
      owned: Number(row.querySelector('[data-field="owned"]').value) || 0,
      price: Number(row.querySelector('[data-field="price"]').value) || 0
    }))
    .filter((card) => card.name || card.required || card.owned || card.price);

  const references = [...elements.referenceRows.querySelectorAll(".reference-row")]
    .map((row) => ({
      title: row.querySelector('[data-field="title"]').value.trim(),
      url: row.querySelector('[data-field="url"]').value.trim()
    }))
    .filter((reference) => reference.title || reference.url);

  return {
    id: state.editingId || crypto.randomUUID(),
    name: elements.deckName.value.trim(),
    regulation: elements.deckRegulation.value.trim(),
    memo: elements.deckMemo.value.trim(),
    showCardList: document.querySelector("#showCardList")?.checked === true,
    cardListImageUrl: document.querySelector("#cardListImageUrl")?.value.trim() || "",
    cards,
    references,
    updatedAt: new Date().toISOString()
  };
}

async function saveCurrentDeck(event) {
  event.preventDefault();
  const deck = collectFormDeck();

  if (!deck.name || !deck.regulation) {
    showToast("デッキ名とレギュレーションを入力してください。");
    return;
  }

  const nextDecks = state.editingId
    ? state.decks.map((item) => item.id === state.editingId ? deck : item)
    : [deck, ...state.decks];

  const saved = await publishDecks(nextDecks, "GitHubに保存しました。GitHub Pagesへの反映まで少し待ってください。");
  if (saved) {
    if (!state.editingId) {
      state.activeRegulation = deck.regulation;
    }
    closeEditor();
    render();
  }
}

async function deleteCurrentDeck() {
  if (!state.editingId) {
    return;
  }

  const deck = state.decks.find((item) => item.id === state.editingId);
  const ok = window.confirm(`${deck.name}を削除しますか？`);
  if (!ok) {
    return;
  }

  const nextDecks = state.decks.filter((item) => item.id !== state.editingId);
  const saved = await publishDecks(nextDecks, "削除してGitHubに保存しました。");
  if (saved) {
    if (!allRegulations().includes(state.activeRegulation)) {
      state.activeRegulation = "すべて";
    }
    closeEditor();
    render();
  }
}

function exportDecks() {
  const payload = {
    updatedAt: new Date().toISOString(),
    decks: state.decks
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `deck-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("書き出しました。");
}

async function importDecks(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    try {
      const parsed = JSON.parse(reader.result);
      const decks = normalizeDecks(Array.isArray(parsed) ? parsed : parsed.decks);
      if (decks.length === 0) {
        throw new Error("Invalid data");
      }
      const saved = await publishDecks(decks, "読み込んだ内容をGitHubに保存しました。");
      if (saved) {
        state.activeRegulation = "すべて";
        render();
      }
    } catch {
      showToast("読み込めないファイルです。");
    } finally {
      elements.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}
