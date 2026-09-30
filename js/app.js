import { firebaseConfig } from "./firebase-config.js";

// The wishlist itself (items + photos) is plain static content in this
// repo — data/items.json and images/. The ONLY thing that needs a live
// backend is the shared "someone claimed this" flag, because GitHub Pages
// serves files and can't remember anything. That lives in Firestore, one
// tiny {claimed: bool} document per item, with no accounts involved.
const FIREBASE_READY =
  !!firebaseConfig && !String(firebaseConfig.projectId || "").includes("PASTE_ME");

let db = null;
let fs = null;

if (FIREBASE_READY) {
  const [{ initializeApp }, firestore] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"),
  ]);
  fs = firestore;
  db = firestore.getFirestore(initializeApp(firebaseConfig));
}

const gridEl = document.getElementById("items-grid");
const emptyEl = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const chipRow = document.getElementById("category-chips");
const noticeEl = document.getElementById("notice");
const langSwitchEl = document.getElementById("lang-switch");

// Internal id for the "all categories" chip — never shown, only the
// translated label (t("all-categories")) is.
const ALL_CATEGORIES = "__ALL__";

let allItems = [];
let claims = {}; // item id -> true/false
let selectedCategory = ALL_CATEGORIES;

// "custom" is the order Milana put the items in inside data/items.json.
const state = { search: "", sort: "custom" };

// ---- Language: Russian is the default and the source language; Latvian is
// a translation layer on top. Claims are keyed by item id, so a box ticked
// in one language shows ticked in the other automatically. ----

const LANG_KEY = "wishlist-lang";
let LANG = "ru";
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "ru" || saved === "lv") LANG = saved;
} catch {
  // Private browsing etc. — just fall back to the default language.
}

// Category names as written in data/items.json (Russian) mapped to Latvian.
const CATEGORY_LV = {
  "Для дома": "Mājai",
  "Игрушки": "Rotaļlietas",
  "Красота": "Skaistums",
  "Украшения": "Rotaslietas",
  "Техника": "Tehnika",
  "Творчество и канцелярия": "Radošums un kancelejas preces",
  "Одежда": "Apģērbs",
  "Еда и напитки": "Ēdieni un dzērieni",
  "Книги": "Grāmatas",
};

function categoryLabel(category) {
  if (LANG === "lv") return CATEGORY_LV[category] || category;
  return category;
}

const I18N = {
  ru: {
    subtitle: "Нажми «Я куплю» на подарках, которые дарят один раз — все увидят, что он уже занят",
    "rules-line1": "Свои идеи тоже приветствуются, и самодельное тоже!!!",
    "rules-line2": "Подарки в случайном порядке",
    "gold-legend-text": "= прямо очень хочу и давно хочу",
    "search-placeholder": "Поиск по списку...",
    "sort-custom": "Как в списке",
    "sort-price-asc": "Сначала дешёвые",
    "sort-price-desc": "Сначала дорогие",
    "all-categories": "Все",
    "empty-state": "Ничего не нашлось",
    "load-error": "Не получилось загрузить список.",
    claimed: "Занято",
    "claim-cta": "Я куплю",
    "claim-disabled-title": "Отметки пока не подключены",
    "multi-badge": "Можно больше одного!",
    "claims-load-error-prefix": "Не получилось загрузить отметки: ",
    "claim-save-error-prefix": "Не получилось сохранить — проверь соединение. ",
    "interests-title": "Интересы",
    "int-minecraft-term": "Майнкрафт",
    "int-minecraft-desc": "можно дарить всё с майнкрафтом",
    "int-minions-term": "Миньоны",
    "int-minions-desc": "можно дарить всё с миньонами",
    "int-dino-term": "Динозавры",
    "int-dino-desc": "можно дарить всё с динозаврами",
    "int-sudoku-term": "Судоку",
    "int-sudoku-desc": "можно дарить журналы судоку",
    "int-taylor-term": "Тейлор Свифт",
    "int-taylor-desc": "её мерч и всё с ней",
    "about-title": "Про меня",
    "not-eat-term": "Я не ем",
    "not-eat-desc": "глютен, молочку и пальмовое масло",
    "colors-term": "Любимые цвета",
    "color-pink": "нежно-розовый",
    "and-connector": "и",
    "color-lv": "латышский",
    "shoe-size-term": "Размер обуви",
    "clothing-size-term": "Размер одежды",
    "gold-love-term": "Люблю золотое и блестящее",
    "matcha-love-term": "Люблю матчу",
    thanks: "Спасибо! 💛",
  },
  lv: {
    subtitle: "Nospied „Es to nopirkšu” pie dāvanām, ko dāvina tikai vienu reizi — visi redzēs, ka tā jau ir aizņemta",
    "rules-line1": "Savas idejas arī ir gaidītas, un pašrocīgi darinātais arī!!!",
    "rules-line2": "Dāvanas nejaušā secībā",
    "gold-legend-text": "= tiešām ļoti gribu un jau sen gribu",
    "search-placeholder": "Meklēt sarakstā...",
    "sort-custom": "Kā sarakstā",
    "sort-price-asc": "Vispirms lētākās",
    "sort-price-desc": "Vispirms dārgākās",
    "all-categories": "Visi",
    "empty-state": "Nekas netika atrasts",
    "load-error": "Neizdevās ielādēt sarakstu.",
    claimed: "Aizņemts",
    "claim-cta": "Es to nopirkšu",
    "claim-disabled-title": "Atzīmes vēl nav pievienotas",
    "multi-badge": "Var dāvināt vairāk par vienu!",
    "claims-load-error-prefix": "Neizdevās ielādēt atzīmes: ",
    "claim-save-error-prefix": "Neizdevās saglabāt — pārbaudi savienojumu. ",
    "interests-title": "Intereses",
    "int-minecraft-term": "Minecraft",
    "int-minecraft-desc": "var dāvināt visu, kas saistīts ar Minecraft",
    "int-minions-term": "Minjoni",
    "int-minions-desc": "var dāvināt visu ar minjoniem",
    "int-dino-term": "Dinozauri",
    "int-dino-desc": "var dāvināt visu ar dinozauriem",
    "int-sudoku-term": "Sudoku",
    "int-sudoku-desc": "var dāvināt sudoku žurnālus",
    "int-taylor-term": "Taylor Swift",
    "int-taylor-desc": "viņas merčs un viss, kas saistīts ar viņu",
    "about-title": "Par mani",
    "not-eat-term": "Es neēdu",
    "not-eat-desc": "glutēnu, piena produktus un palmu eļļu",
    "colors-term": "Iecienītākās krāsas",
    "color-pink": "maigi rozā",
    "and-connector": "un",
    "color-lv": "Latvijas",
    "shoe-size-term": "Apavu izmērs",
    "clothing-size-term": "Apģērba izmērs",
    "gold-love-term": "Man patīk zelta un spīdīgas lietas",
    "matcha-love-term": "Man patīk matča",
    thanks: "Paldies! 💛",
  },
};

function t(key) {
  return I18N[LANG][key] ?? I18N.ru[key] ?? key;
}

function applyStaticI18n() {
  document.documentElement.lang = LANG;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  langSwitchEl.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === LANG);
  });
}

function setLang(lang) {
  if (lang !== "ru" && lang !== "lv") return;
  LANG = lang;
  try {
    localStorage.setItem(LANG_KEY, LANG);
  } catch {
    // Ignore — the switch still works for the rest of this visit.
  }
  applyStaticI18n();
  renderCategoryChips();
  render();
}

langSwitchEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-btn");
  if (btn) setLang(btn.dataset.lang);
});

applyStaticI18n();

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  render();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

// ---- Items: static JSON in the repo ----

function normalize(raw, index) {
  // A missing price means "no price shown", not €0 — some things on the
  // list ("a book of your favourite recipes") don't have one.
  const blank = (v) => v === undefined || v === null || v === "";
  const priceMin = blank(raw.priceMin) ? NaN : Number(raw.priceMin);
  const priceMaxRaw = raw.priceMax === undefined || raw.priceMax === null || raw.priceMax === ""
    ? priceMin
    : Number(raw.priceMax);
  return {
    id: String(raw.id),
    // name/description are Russian (or already English/Latvian) in
    // items.json; the _lv fields are only present where a Russian original
    // needed translating, and fall back to the same text otherwise.
    name: raw.name || "Untitled",
    nameLv: raw.name_lv || raw.name || "Untitled",
    description: raw.description || "",
    descriptionLv: raw.description_lv || raw.description || "",
    priceMin: Number.isFinite(priceMin) ? priceMin : null,
    priceMax: Number.isFinite(priceMaxRaw) ? priceMaxRaw : null,
    // Milana's own notation from the slides: "~€20", "€15–50", "~бесценно".
    priceLabel: typeof raw.priceLabel === "string" ? raw.priceLabel : "",
    priceLabelLv: typeof raw.priceLabel_lv === "string" ? raw.priceLabel_lv : (typeof raw.priceLabel === "string" ? raw.priceLabel : ""),
    currency: raw.currency || "EUR",
    category: raw.category || "",
    link: raw.link || "",
    // The star from the wishlist slides: "прямо очень хочу и давно хочу".
    // Shown as a gold frame on the card rather than as text.
    starred: raw.starred === true,
    quantityType: raw.quantityType === "multiple" ? "multiple" : "single",
    image: raw.image || "",
    added: raw.added || "",
    _order: index,
  };
}

async function loadItems() {
  const res = await fetch("data/items.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`couldn't load data/items.json (HTTP ${res.status})`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error("data/items.json must be a list of items");
  return raw.map(normalize);
}

// ---- Claims: the one live bit ----

function watchClaims() {
  if (!db) {
    showNotice(
      "Claim syncing isn't connected yet — tick boxes won't save. " +
        "Add your Firebase config to js/firebase-config.js to switch it on."
    );
    return;
  }
  fs.onSnapshot(
    fs.collection(db, "claims"),
    (snapshot) => {
      claims = {};
      snapshot.docs.forEach((d) => {
        claims[d.id] = !!d.data().claimed;
      });
      render();
    },
    (err) => showNotice(t("claims-load-error-prefix") + err.message)
  );
}

function setClaim(itemId, claimed) {
  return fs.setDoc(fs.doc(db, "claims", itemId), { claimed });
}

function showNotice(text) {
  noticeEl.textContent = text;
  noticeEl.classList.remove("hidden");
}

// ---- Rendering ----

function renderCategoryChips() {
  // selectedCategory always holds the canonical (Russian) category name, so
  // the filter survives a language switch — only the chip's label changes.
  const categories = Array.from(
    new Set(allItems.map((i) => i.category).filter(Boolean))
  ).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));

  if (!categories.includes(selectedCategory) && selectedCategory !== ALL_CATEGORIES) {
    selectedCategory = ALL_CATEGORIES;
  }

  chipRow.innerHTML = "";
  chipRow.appendChild(makeChip(ALL_CATEGORIES, t("all-categories")));
  categories.forEach((c) => chipRow.appendChild(makeChip(c, categoryLabel(c))));
}

function makeChip(value, label) {
  const chip = document.createElement("button");
  chip.className = "chip" + (value === selectedCategory ? " active" : "");
  chip.textContent = label;
  chip.addEventListener("click", () => {
    selectedCategory = value;
    renderCategoryChips();
    render();
  });
  return chip;
}

function formatPrice(item) {
  const label = LANG === "lv" ? item.priceLabelLv : item.priceLabel;
  if (label) return label;
  const symbol = item.currency === "EUR" ? "€" : item.currency + " ";
  const { priceMin: min, priceMax: max } = item;
  if (min == null) return "";
  if (max == null || max === min) return `${symbol}${min}`;
  return `${symbol}${min}–${max}`;
}

function matchesFilters(item) {
  if (selectedCategory !== ALL_CATEGORIES && item.category !== selectedCategory) return false;
  if (state.search) {
    const name = LANG === "lv" ? item.nameLv : item.name;
    const description = LANG === "lv" ? item.descriptionLv : item.description;
    const haystack = `${name} ${description}`.toLowerCase();
    if (!haystack.includes(state.search)) return false;
  }
  return true;
}

function sortItems(items) {
  const sorted = [...items];
  switch (state.sort) {
    case "custom":
      sorted.sort((a, b) => a._order - b._order);
      break;
    case "price-asc":
      sorted.sort((a, b) => (a.priceMin ?? 0) - (b.priceMin ?? 0) || a._order - b._order);
      break;
    case "price-desc":
      sorted.sort((a, b) => (b.priceMin ?? 0) - (a.priceMin ?? 0) || a._order - b._order);
      break;
    case "newest": {
      // Sorts by the optional "added" date. Items without one keep the
      // order they appear in items.json, after any dated ones.
      const stamp = (i) => (i.added ? Date.parse(i.added) : NaN);
      sorted.sort((a, b) => {
        const aT = stamp(a), bT = stamp(b);
        if (Number.isNaN(aT) && Number.isNaN(bT)) return a._order - b._order;
        if (Number.isNaN(aT)) return 1;
        if (Number.isNaN(bT)) return -1;
        return bT - aT || a._order - b._order;
      });
      break;
    }
  }
  return sorted;
}

function render() {
  const filtered = sortItems(allItems.filter(matchesFilters));

  gridEl.innerHTML = "";
  emptyEl.style.display = filtered.length === 0 ? "block" : "none";
  filtered.forEach((item) => gridEl.appendChild(renderCard(item)));
}

function renderCard(item) {
  const isSingle = item.quantityType === "single";
  const claimed = isSingle && !!claims[item.id];

  const card = document.createElement("div");
  card.className =
    "card" + (item.starred ? " is-starred" : "") + (claimed ? " is-claimed" : "");

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  if (item.image) {
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = LANG === "lv" ? item.nameLv : item.name;
    img.loading = "lazy";
    imageWrap.appendChild(img);
  }
  card.appendChild(imageWrap);

  if (claimed) {
    const ribbon = document.createElement("div");
    ribbon.className = "claimed-ribbon";
    ribbon.textContent = t("claimed");
    card.appendChild(ribbon);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  // The category isn't printed on the card — it only drives the chip filter
  // above the grid.

  const itemName = LANG === "lv" ? item.nameLv : item.name;
  const itemDescription = LANG === "lv" ? item.descriptionLv : item.description;

  const name = document.createElement("h3");
  name.className = "card-name";
  if (item.link) {
    // Where there's a shop page for it, the name itself is the link.
    const named = document.createElement("a");
    named.className = "card-name-link";
    named.href = item.link;
    named.target = "_blank";
    named.rel = "noopener noreferrer";
    named.textContent = itemName;
    name.appendChild(named);
  } else {
    name.textContent = itemName;
  }
  body.appendChild(name);

  if (itemDescription) {
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = itemDescription;
    body.appendChild(desc);
  }

  const price = document.createElement("div");
  price.className = "card-price";
  price.textContent = formatPrice(item);
  body.appendChild(price);

  const footer = document.createElement("div");
  footer.className = "card-footer";

  // The link lives on the card name, so the footer just holds the claim tick.
  footer.appendChild(document.createElement("span"));

  if (isSingle) {
    const toggle = document.createElement("label");
    toggle.className = "claim-toggle" + (claimed ? " checked" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = claimed;
    checkbox.disabled = !db;
    if (!db) toggle.title = t("claim-disabled-title");
    checkbox.addEventListener("change", () => {
      const wanted = checkbox.checked;
      setClaim(item.id, wanted).catch((err) => {
        checkbox.checked = !wanted;
        alert(t("claim-save-error-prefix") + err.message);
      });
    });
    const labelText = document.createElement("span");
    labelText.textContent = claimed ? t("claimed") : t("claim-cta");
    toggle.appendChild(checkbox);
    toggle.appendChild(labelText);
    footer.appendChild(toggle);
  } else {
    const badge = document.createElement("span");
    badge.className = "multi-badge";
    badge.textContent = t("multi-badge");
    footer.appendChild(badge);
  }

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}

// ---- Go ----

try {
  allItems = await loadItems();
  renderCategoryChips();
  render();
  watchClaims();
} catch (err) {
  emptyEl.innerHTML = `<p>${t("load-error")}</p><p style="font-size:0.85rem">${err.message}</p>`;
  emptyEl.style.display = "block";
}
