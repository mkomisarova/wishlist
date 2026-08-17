# Milana's Wishlist

A wishlist website hosted free on GitHub Pages. Visitors browse, search,
filter and sort the list, and can tick "I'll get this" on one-of-a-kind
items so everyone else can see it's taken — **with no account and no
login for anyone**, including me.

## How it's put together

Almost everything is plain static files in this repo:

| What | Where | How I change it |
|---|---|---|
| The items | `data/items.json` | Edit on github.com, or use `tools/editor.html` |
| The photos | `images/` | Drag and drop onto github.com |
| The page | `index.html`, `css/`, `js/` | Rarely — it's done |

The one exception is the **"someone claimed this" tick**. GitHub Pages
serves files and runs no code, so it can't remember that your cousin
ticked a box. That one boolean per item lives in Firebase Firestore —
free tier, no credit card, no accounts. It stores nothing else: no names,
no emails, no personal data. Just `claimed: true/false` per item id.

If Firebase isn't set up, **the site still works** — the wishlist renders
normally and the tick boxes are simply disabled.

## Adding or changing items

### The easy way — the editor

Open `tools/editor.html` by double-clicking it. It runs entirely on your
own computer, with no login and nothing uploaded.

1. Load your current `data/items.json`
2. Add, edit or remove items with the form
3. Click **Download items.json**
4. On github.com, drop that file into `data/` (replacing the old one) and
   any new photos into `images/`

### The direct way — edit on GitHub

`data/items.json` is a list of items. Click the pencil icon on
github.com and edit it there:

```json
{
  "id": "botanical-lego",
  "name": "Botanical Garden Lego",
  "description": "The flower bouquet one.",
  "priceMin": 15,
  "priceMax": 50,
  "currency": "EUR",
  "category": "Lego",
  "link": "https://www.lego.com/",
  "quantityType": "single",
  "image": "images/lego.jpg",
  "added": "2026-08-17"
}
```

| Field | Notes |
|---|---|
| `id` | **Must be unique, and must never change.** This is what ties an item to its claim tick — rename the id and the item comes back unclaimed. |
| `priceMin` / `priceMax` | Numbers, no quotes. Leave `priceMax` out for a single price; include it for a range like 15–50. Sorting uses `priceMin`. |
| `quantityType` | `"single"` shows a claim tick box. `"multiple"` shows none — for things like lip gloss where more is fine. |
| `link`, `description`, `image` | Optional. An empty `image` shows a soft pink placeholder. |
| `added` | Optional date, used by the "Newest first" sort. |

Every push runs a check on `data/items.json` (see the Actions tab). If
you leave a stray comma or two items share an id, you get a red ✗ and an
explanation instead of a broken site.

## One-time setup

### GitHub Pages

Repo **Settings → Pages** → Source: "Deploy from a branch" → branch
`main`, folder `/ (root)` → Save. Live in a minute or two at
`https://<username>.github.io/<repo>/`.

### Firebase (only for the claim ticks)

**Already set up** — project `wishlist-6c084`, config in
`js/firebase-config.js`, rules published. Nothing to do here.

If you ever edit `firestore.rules`, publish the change with:

```
firebase deploy --only firestore:rules --project wishlist-6c084
```

That reads `firebase.json` in this repo. If it says you're logged out,
run `firebase login --reauth` first.

Do **not** enable Firebase Storage or Authentication. This site uses
neither, and Storage is the part that asks for a paid plan.

The config values in `js/firebase-config.js` are safe to commit — they
are not secret keys, they just name the project. `firestore.rules` is
what actually protects the data.

## Things worth knowing

- **Anyone can untick someone else's claim.** That's the trade for
  requiring no login. Fine among family; not tamper-proof.
- **Claims are keyed on item `id`.** Changing an id resets that item's
  claim. Renaming the `name` is always safe.
- **Deleting an item** leaves a stray claim document in Firestore.
  Harmless, and it's reused if you ever add that id back.
