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

const ALL_CATEGORIES = "Все";

let allItems = [];
let claims = {}; // item id -> true/false
let selectedCategory = ALL_CATEGORIES;

// "custom" is the order Milana put the items in inside data/items.json.
const state = { search: "", sort: "custom" };

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
    name: raw.name || "Untitled",
    description: raw.description || "",
    priceMin: Number.isFinite(priceMin) ? priceMin : null,
    priceMax: Number.isFinite(priceMaxRaw) ? priceMaxRaw : null,
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
    (err) => showNotice("Не получилось загрузить отметки: " + err.message)
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
  const categories = Array.from(
    new Set(allItems.map((i) => i.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  if (!categories.includes(selectedCategory) && selectedCategory !== ALL_CATEGORIES) {
    selectedCategory = ALL_CATEGORIES;
  }

  chipRow.innerHTML = "";
  chipRow.appendChild(makeChip(ALL_CATEGORIES));
  categories.forEach((c) => chipRow.appendChild(makeChip(c)));
}

function makeChip(label) {
  const chip = document.createElement("button");
  chip.className = "chip" + (label === selectedCategory ? " active" : "");
  chip.textContent = label;
  chip.addEventListener("click", () => {
    selectedCategory = label;
    renderCategoryChips();
    render();
  });
  return chip;
}

function formatPrice(item) {
  const symbol = item.currency === "EUR" ? "€" : item.currency + " ";
  const { priceMin: min, priceMax: max } = item;
  if (min == null) return "";
  if (max == null || max === min) return `${symbol}${min}`;
  return `${symbol}${min}–${max}`;
}

function matchesFilters(item) {
  if (selectedCategory !== ALL_CATEGORIES && item.category !== selectedCategory) return false;
  if (state.search) {
    const haystack = `${item.name} ${item.description}`.toLowerCase();
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
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
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
    img.alt = item.name;
    img.loading = "lazy";
    imageWrap.appendChild(img);
  }
  card.appendChild(imageWrap);

  if (claimed) {
    const ribbon = document.createElement("div");
    ribbon.className = "claimed-ribbon";
    ribbon.textContent = "Забронировано";
    card.appendChild(ribbon);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  if (item.category) {
    const cat = document.createElement("div");
    cat.className = "card-category";
    cat.textContent = item.category;
    body.appendChild(cat);
  }

  const name = document.createElement("h3");
  name.className = "card-name";
  name.textContent = item.name;
  body.appendChild(name);

  if (item.description) {
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = item.description;
    body.appendChild(desc);
  }

  const price = document.createElement("div");
  price.className = "card-price";
  price.textContent = formatPrice(item);
  body.appendChild(price);

  const footer = document.createElement("div");
  footer.className = "card-footer";

  if (item.link) {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View →";
    footer.appendChild(link);
  } else {
    footer.appendChild(document.createElement("span"));
  }

  if (isSingle) {
    const toggle = document.createElement("label");
    toggle.className = "claim-toggle" + (claimed ? " checked" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = claimed;
    checkbox.disabled = !db;
    if (!db) toggle.title = "Отметки пока не подключены";
    checkbox.addEventListener("change", () => {
      const wanted = checkbox.checked;
      setClaim(item.id, wanted).catch((err) => {
        checkbox.checked = !wanted;
        alert("Не получилось сохранить — проверь соединение. " + err.message);
      });
    });
    const labelText = document.createElement("span");
    labelText.textContent = claimed ? "Забронировано" : "Я куплю";
    toggle.appendChild(checkbox);
    toggle.appendChild(labelText);
    footer.appendChild(toggle);
  } else {
    const badge = document.createElement("span");
    badge.className = "multi-badge";
    badge.textContent = "Можно больше одного!";
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
  emptyEl.innerHTML = `<p>Не получилось загрузить список.</p><p style="font-size:0.85rem">${err.message}</p>`;
  emptyEl.style.display = "block";
}
