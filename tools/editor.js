// A local, no-login replacement for the old admin.html. It never talks to
// a server: you open it from your own disk, it edits the list in memory,
// and hands you an items.json to commit to the repo. GitHub itself is the
// login.

const $ = (id) => document.getElementById(id);

const loadInput = $("load-input");
const loadStatus = $("load-status");
const itemForm = $("item-form");
const formTitle = $("form-title");
const submitBtn = $("submit-btn");
const cancelEditBtn = $("cancel-edit-btn");
const formMsg = $("form-msg");
const itemsList = $("items-list");
const itemCount = $("item-count");
const categoryList = $("category-list");
const imageInput = $("item-image");
const imagePathInput = $("item-image-path");
const imagePreview = $("image-preview");
const downloadBtn = $("download-btn");
const downloadMsg = $("download-msg");
const imageTodo = $("image-todo");

let items = [];
let editingId = null;
// Photos picked in this session, so we can remind you which files still
// need dropping into images/ alongside the JSON.
const pickedImages = new Set();

// ---- Loading ----

loadInput.addEventListener("change", async () => {
  const file = loadInput.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("that file isn't a list of items");
    items = parsed;
    loadStatus.textContent = `Loaded ${items.length} item${items.length === 1 ? "" : "s"} from ${file.name}.`;
    renderAll();
  } catch (err) {
    loadStatus.innerHTML = `<span class="msg error">Couldn't read that file: ${err.message}</span>`;
  }
});

// If the editor happens to be opened through a web server rather than
// double-clicked, pre-load the live list as a convenience.
if (location.protocol.startsWith("http")) {
  fetch("../data/items.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((parsed) => {
      if (Array.isArray(parsed) && items.length === 0) {
        items = parsed;
        loadStatus.textContent = `Loaded ${items.length} existing item(s) automatically.`;
        renderAll();
      }
    })
    .catch(() => {});
}

// ---- Helpers ----

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

function uniqueId(base, ignoreId = null) {
  let id = base;
  let n = 2;
  while (items.some((i) => i.id === id && i.id !== ignoreId)) id = `${base}-${n++}`;
  return id;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Photo picking ----

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  imagePathInput.value = `images/${safeName}`;
  pickedImages.add(safeName);
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.classList.remove("hidden");
  renderImageTodo();
});

imagePathInput.addEventListener("input", () => {
  if (!imagePathInput.value) imagePreview.classList.add("hidden");
});

// ---- Add / edit ----

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("item-name").value.trim();
  const priceMin = parseFloat($("item-price-min").value);
  const priceMaxRaw = $("item-price-max").value;
  const priceMax = priceMaxRaw ? parseFloat(priceMaxRaw) : priceMin;

  if (priceMax < priceMin) {
    formMsg.innerHTML = `<div class="msg error">The high end of the range is lower than the low end.</div>`;
    return;
  }

  const data = {
    // The id is what ties an item to its claim tick. Once an item exists,
    // its id never changes — renaming the item keeps the claim intact.
    id: editingId || uniqueId(slugify(name)),
    name,
    description: $("item-description").value.trim(),
    priceMin,
    priceMax,
    currency: "EUR",
    category: $("item-category").value.trim(),
    link: $("item-link").value.trim(),
    quantityType: document.querySelector('input[name="quantityType"]:checked').value,
    image: imagePathInput.value.trim(),
    added: editingId ? items.find((i) => i.id === editingId)?.added || todayISO() : todayISO(),
  };

  if (editingId) {
    items = items.map((i) => (i.id === editingId ? data : i));
    formMsg.innerHTML = `<div class="msg success">Updated "${data.name}".</div>`;
  } else {
    items.push(data);
    formMsg.innerHTML = `<div class="msg success">Added "${data.name}". Don't forget to download the file below.</div>`;
  }

  resetForm();
  renderAll();
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
  formMsg.innerHTML = "";
});

function resetForm() {
  editingId = null;
  itemForm.reset();
  imagePathInput.value = "";
  imagePreview.classList.add("hidden");
  formTitle.textContent = "2 · Add an item";
  submitBtn.textContent = "Add item";
  cancelEditBtn.classList.add("hidden");
}

function startEdit(item) {
  editingId = item.id;
  formTitle.textContent = `Editing "${item.name}"`;
  submitBtn.textContent = "Update item";
  cancelEditBtn.classList.remove("hidden");

  $("item-name").value = item.name || "";
  $("item-description").value = item.description || "";
  $("item-price-min").value = item.priceMin ?? "";
  $("item-price-max").value = item.priceMax ?? "";
  $("item-category").value = item.category || "";
  $("item-link").value = item.link || "";
  document.querySelector(
    `input[name="quantityType"][value="${item.quantityType === "multiple" ? "multiple" : "single"}"]`
  ).checked = true;
  imagePathInput.value = item.image || "";
  imagePreview.classList.add("hidden");
  imageInput.value = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function removeItem(item) {
  if (!confirm(`Remove "${item.name}" from the list?`)) return;
  items = items.filter((i) => i.id !== item.id);
  if (editingId === item.id) resetForm();
  renderAll();
}

// ---- Rendering ----

function renderAll() {
  renderList();
  renderCategories();
  renderImageTodo();
}

function renderCategories() {
  const cats = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
  categoryList.innerHTML = "";
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    categoryList.appendChild(opt);
  });
}

function renderList() {
  itemCount.textContent = items.length;
  itemsList.innerHTML = "";

  if (items.length === 0) {
    itemsList.innerHTML = `<p class="hint">Nothing yet — add your first item above.</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-item-row";

    const img = document.createElement("img");
    if (item.image) img.src = "../" + item.image;
    img.alt = "";
    row.appendChild(img);

    const info = document.createElement("div");
    info.className = "info";

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = item.name || "(no name)";
    info.appendChild(nameEl);

    const priceText =
      item.priceMax && item.priceMax !== item.priceMin
        ? `${item.priceMin}–${item.priceMax} ${item.currency || "EUR"}`
        : `${item.priceMin ?? "?"} ${item.currency || "EUR"}`;
    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    metaEl.textContent = `${priceText} · ${item.category || "Uncategorized"} · ${
      item.quantityType === "multiple" ? "wants many" : "just one"
    }`;
    info.appendChild(metaEl);

    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(item));
    actions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", () => removeItem(item));
    actions.appendChild(delBtn);

    row.appendChild(actions);
    itemsList.appendChild(row);
  });
}

function renderImageTodo() {
  const needed = Array.from(pickedImages).filter((n) =>
    items.some((i) => i.image === `images/${n}`)
  );
  if (needed.length === 0) {
    imageTodo.innerHTML = "";
    return;
  }
  imageTodo.innerHTML =
    `<div class="msg success">Photos to drop into <code>images/</code>: ` +
    needed.map((n) => `<code>${n}</code>`).join(", ") +
    `</div>`;
}

// ---- Download ----

downloadBtn.addEventListener("click", () => {
  const problems = validate(items);
  if (problems.length) {
    downloadMsg.innerHTML =
      `<div class="msg error">Fix these first:<br>` + problems.join("<br>") + `</div>`;
    return;
  }
  const blob = new Blob([JSON.stringify(items, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "items.json";
  a.click();
  URL.revokeObjectURL(a.href);
  downloadMsg.innerHTML = `<div class="msg success">Downloaded — now put it in the repo's <code>data/</code> folder.</div>`;
});

function validate(list) {
  const problems = [];
  const seen = new Set();
  list.forEach((item, idx) => {
    const where = `Item ${idx + 1} ("${item.name || "no name"}")`;
    if (!item.id) problems.push(`${where}: missing id`);
    if (seen.has(item.id)) problems.push(`${where}: duplicate id "${item.id}"`);
    seen.add(item.id);
    if (!item.name) problems.push(`${where}: missing name`);
    if (!Number.isFinite(item.priceMin)) problems.push(`${where}: price isn't a number`);
  });
  return problems;
}

renderAll();
