# Milana's Wishlist — setup guide

This is a small website: a public page (`index.html`) where anyone with the
link can browse your wishlist, filter/sort it, and check items off — and a
private page (`admin.html`) only you can sign into, to add/edit/delete items
from your phone or computer.

It needs two free services, both one-time setup:
- **Firebase** — stores the items and who's claimed what, live, so everyone
  sees updates instantly with no login required for them.
- **GitHub Pages** — hosts the actual website for free at a link like
  `https://yourusername.github.io/wishlist`.

Total cost: **€0**, both stay comfortably inside their free tiers for a
personal wishlist.

---

## 1. Create the Firebase project (~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with any Google account.
2. Click **Add project**, give it any name (e.g. "milana-wishlist"), and finish the wizard (you can decline Google Analytics, you don't need it).
3. In the left sidebar, click **Build → Firestore Database → Create database**. Choose a region close to you (e.g. `europe-west3`), and start in **production mode**.
4. Click **Build → Storage → Get started**. Same region, production mode.
5. Click **Build → Authentication → Get started**. Under "Sign-in method", enable **Email/Password**. Then go to the **Users** tab and click **Add user** — use your own email and pick a password. This is the login you'll use on `admin.html`.
6. Go to **Project settings** (gear icon, top left) → scroll to "Your apps" → click the **</>** (web) icon → register an app (any nickname) → it'll show you a `firebaseConfig` object. Copy it.
7. Open `js/firebase-config.js` in this project and paste your values in, replacing the `"PASTE_ME"` placeholders.
8. Back in the Firebase console: **Firestore Database → Rules tab** — replace the contents with what's in `firestore.rules` in this project, then **Publish**.
9. **Storage → Rules tab** — same thing, paste in `storage.rules`, **Publish**.

That's it for Firebase — the site now has somewhere to store items and claims.

---

## 2. Put it on GitHub Pages

If you're comfortable with GitHub yourself:
1. Create a new repository (public), push these files to it.
2. Repo **Settings → Pages** → Source: deploy from branch → pick `main` and `/ (root)`.
3. Your site will be live in a minute or two at `https://<yourusername>.github.io/<repo-name>/`.

If you'd rather I push it for you: generate a **fine-grained Personal Access
Token** (GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens) scoped to just this one repository with
Contents: Read and write permission, and share it with me in this chat —
I'll create the repo, push the code, and turn on Pages for you. You can
revoke the token afterward if you like; I only need it for the initial
push and any future updates to the code itself (not for day-to-day adding
of wishlist items — that happens through `admin.html`, no GitHub involved).

---

## 3. Add your first items

Visit `https://<your-site>/admin.html`, sign in with the email/password you
created in step 1.5, and fill in the form: photo, name, description, price
(or a low/high range like 15–50), category, an optional link, and whether
it's "just one" (shows a claim checkbox on the public page) or "as many as
people want" (just displays, no checkbox — per your call).

---

## 4. Getting your existing wishlist photos out of Google Slides

Since your current wishlist lives in a Slides deck: **File → Download →
PNG image** will only export the *current slide*, so for a full deck it's
easier to use **File → Download → PDF**, then split/crop images from that,
OR (better quality) if you still have the original photos anywhere — your
phone's Photos library, a Downloads folder, wherever you originally added
them from — grab those directly instead of re-exporting from the slide,
since a screenshot-of-a-slide will look softer than the original file.

---

## 5. Notes

- Nobody needs an account to browse the wishlist or check things off — only
  you need to log in, and only to add/edit/delete items.
- The "claimed" checkbox is genuinely shared and live: if two people have
  the page open, one checking a box updates the other's screen in real time.
- The free Firebase tier allows far more daily reads/writes than a personal
  wishlist shared with friends/family will ever use.
- If you ever want a custom domain (e.g. `wishlist.yourname.com`) instead of
  the github.io address, that's a small additional step in GitHub Pages
  settings — ask and I'll walk you through it.
