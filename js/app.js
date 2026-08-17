import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gridEl = document.getElementById("items-grid");
const emptyEl = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const chipRow = document.getElementById("category-chips");

let allItems = [];
let selectedCategory = "All";

const state = {
  search: "",
  sort: "price-asc",
};

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  render();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

// Live-sync items collection. Any change anywhere (a claim toggle from
// another visitor, or a new item added via admin.html) shows up here
// instantly without a page reload.
onSnapshot(collection(db, "items"), (snapshot) => {
  allItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderCategoryChips();
  render();
});

function renderCategoryChips() {
  const categories = Array.from(
    new Set(allItems.map((i) => i.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  if (!categories.includes(selectedCategory) && selectedCategory !== "All") {
    selectedCategory = "All";
  }

  chipRow.innerHTML = "";
  const allChip = makeChip("All");
  chipRow.appendChild(allChip);
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
  const currency = item.currency || "EUR";
  const symbol = currency === "EUR" ? "€" : currency + " ";
  const min = item.priceMin;
  const max = item.priceMax;
  if (min == null) return "";
  if (max == null || max === min) return `${symbol}${min}`;
  return `${symbol}${min}–${max}`;
}

function matchesFilters(item) {
  if (selectedCategory !== "All" && item.category !== selectedCategory) {
    return false;
  }
  if (state.search) {
    const haystack = `${item.name || ""} ${item.description || ""}`.toLowerCase();
    if (!haystack.includes(state.search)) return false;
  }
  return true;
}

function sortItems(items) {
  const sorted = [...items];
  switch (state.sort) {
    case "price-asc":
      sorted.sort((a, b) => (a.priceMin ?? 0) - (b.priceMin ?? 0));
      break;
    case "price-desc":
      sorted.sort((a, b) => (b.priceMin ?? 0) - (a.priceMin ?? 0));
      break;
    case "name-asc":
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      break;
    case "newest":
      sorted.sort((a, b) => {
        const aT = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bT = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bT - aT;
      });
      break;
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
  const card = document.createElement("div");
  card.className = "card" + (item.quantityType === "single" && item.claimed ? " is-claimed" : "");

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  const img = document.createElement("img");
  img.src = item.imageUrl || "";
  img.alt = item.name || "";
  img.loading = "lazy";
  imageWrap.appendChild(img);
  card.appendChild(imageWrap);

  if (item.quantityType === "single" && item.claimed) {
    const ribbon = document.createElement("div");
    ribbon.className = "claimed-ribbon";
    ribbon.textContent = "Claimed";
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
  name.textContent = item.name || "Untitled";
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

  if (item.quantityType === "single") {
    const toggle = document.createElement("label");
    toggle.className = "claim-toggle" + (item.claimed ? " checked" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!item.claimed;
    checkbox.addEventListener("change", () => {
      updateDoc(doc(db, "items", item.id), { claimed: checkbox.checked }).catch((err) => {
        alert("Couldn't update — check your connection. " + err.message);
        checkbox.checked = !checkbox.checked;
      });
    });
    const labelText = document.createElement("span");
    labelText.textContent = item.claimed ? "Claimed" : "I'll get this";
    toggle.appendChild(checkbox);
    toggle.appendChild(labelText);
    footer.appendChild(toggle);
  } else {
    const badge = document.createElement("span");
    badge.className = "multi-badge";
    badge.textContent = "Happy to have more than one!";
    footer.appendChild(badge);
  }

  body.appendChild(footer);
  card.appendChild(body);

  return card;
}
