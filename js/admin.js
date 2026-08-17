import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const signinCard = document.getElementById("signin-card");
const signinForm = document.getElementById("signin-form");
const signinMsg = document.getElementById("signin-msg");
const adminPanel = document.getElementById("admin-panel");
const authStatus = document.getElementById("auth-status");

const itemForm = document.getElementById("item-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const formMsg = document.getElementById("form-msg");
const itemsList = document.getElementById("items-list");
const categoryList = document.getElementById("category-list");
const imageInput = document.getElementById("item-image");
const imagePreview = document.getElementById("image-preview");

let editingId = null;
let editingImagePath = null;
let allItems = [];

// ---- Auth ----

onAuthStateChanged(auth, (user) => {
  if (user) {
    signinCard.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    authStatus.innerHTML = `Signed in as ${user.email} &middot; <a href="#" id="signout-link">sign out</a>`;
    document.getElementById("signout-link").addEventListener("click", (e) => {
      e.preventDefault();
      signOut(auth);
    });
  } else {
    signinCard.classList.remove("hidden");
    adminPanel.classList.add("hidden");
  }
});

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signinMsg.innerHTML = "";
  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    signinMsg.innerHTML = `<div class="msg error">${err.message}</div>`;
  }
});

// ---- Live item list ----

onSnapshot(collection(db, "items"), (snapshot) => {
  allItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderCategoryOptions();
  renderList();
});

function renderCategoryOptions() {
  const categories = Array.from(new Set(allItems.map((i) => i.category).filter(Boolean)));
  categoryList.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
}

function renderList() {
  itemsList.innerHTML = "";
  if (allItems.length === 0) {
    itemsList.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;">No items yet — add your first one above.</p>`;
    return;
  }
  allItems
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "admin-item-row";

      const img = document.createElement("img");
      img.src = item.imageUrl || "";
      row.appendChild(img);

      const info = document.createElement("div");
      info.className = "info";
      const priceText =
        item.priceMax && item.priceMax !== item.priceMin
          ? `${item.priceMin}–${item.priceMax} ${item.currency || "EUR"}`
          : `${item.priceMin ?? "?"} ${item.currency || "EUR"}`;
      info.innerHTML = `<div class="name">${escapeHtml(item.name || "")}</div>
        <div class="meta">${priceText} · ${escapeHtml(item.category || "Uncategorized")} · ${
        item.quantityType === "single" ? (item.claimed ? "claimed" : "unclaimed") : "wants many"
      }</div>`;
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
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => handleDelete(item));
      actions.appendChild(delBtn);

      row.appendChild(actions);
      itemsList.appendChild(row);
    });
}

// ---- Add / edit form ----

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) {
    imagePreview.classList.add("hidden");
    return;
  }
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.classList.remove("hidden");
});

function startEdit(item) {
  editingId = item.id;
  editingImagePath = item.imagePath || null;
  formTitle.textContent = `Editing "${item.name}"`;
  submitBtn.textContent = "Update item";
  cancelEditBtn.classList.remove("hidden");

  document.getElementById("item-name").value = item.name || "";
  document.getElementById("item-description").value = item.description || "";
  document.getElementById("item-price-min").value = item.priceMin ?? "";
  document.getElementById("item-price-max").value = item.priceMax ?? "";
  document.getElementById("item-category").value = item.category || "";
  document.getElementById("item-link").value = item.link || "";
  document.querySelector(
    `input[name="quantityType"][value="${item.quantityType || "single"}"]`
  ).checked = true;

  if (item.imageUrl) {
    imagePreview.src = item.imageUrl;
    imagePreview.classList.remove("hidden");
  } else {
    imagePreview.classList.add("hidden");
  }
  imageInput.value = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

cancelEditBtn.addEventListener("click", () => resetForm());

function resetForm() {
  editingId = null;
  editingImagePath = null;
  itemForm.reset();
  formTitle.textContent = "Add an item";
  submitBtn.textContent = "Add item";
  cancelEditBtn.classList.add("hidden");
  imagePreview.classList.add("hidden");
  formMsg.innerHTML = "";
}

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  formMsg.innerHTML = "";

  try {
    const name = document.getElementById("item-name").value.trim();
    const description = document.getElementById("item-description").value.trim();
    const priceMin = parseFloat(document.getElementById("item-price-min").value);
    const priceMaxRaw = document.getElementById("item-price-max").value;
    const priceMax = priceMaxRaw ? parseFloat(priceMaxRaw) : priceMin;
    const category = document.getElementById("item-category").value.trim();
    const link = document.getElementById("item-link").value.trim();
    const quantityType = document.querySelector('input[name="quantityType"]:checked').value;

    let imageUrl = editingId ? allItems.find((i) => i.id === editingId)?.imageUrl || "" : "";
    let imagePath = editingImagePath;

    const file = imageInput.files[0];
    if (file) {
      const path = `images/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
      imagePath = path;
    }

    const data = {
      name,
      description,
      priceMin,
      priceMax,
      currency: "EUR",
      category,
      link,
      quantityType,
      imageUrl,
      imagePath,
    };

    if (editingId) {
      await updateDoc(doc(db, "items", editingId), data);
      formMsg.innerHTML = `<div class="msg success">Updated "${name}".</div>`;
    } else {
      data.claimed = false;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "items"), data);
      formMsg.innerHTML = `<div class="msg success">Added "${name}".</div>`;
    }

    resetForm();
  } catch (err) {
    formMsg.innerHTML = `<div class="msg error">${err.message}</div>`;
  } finally {
    submitBtn.disabled = false;
  }
});

async function handleDelete(item) {
  if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
  try {
    await deleteDoc(doc(db, "items", item.id));
    if (item.imagePath) {
      deleteObject(ref(storage, item.imagePath)).catch(() => {
        // Non-fatal: the Firestore doc is gone either way, the image
        // just stays as an orphan file in Storage.
      });
    }
    if (editingId === item.id) resetForm();
  } catch (err) {
    alert("Couldn't delete: " + err.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
