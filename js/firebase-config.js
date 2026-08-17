// ----------------------------------------------------------------------
// PASTE YOUR FIREBASE CONFIG HERE.
//
// This is used for ONE thing: syncing the "someone claimed this" tick
// boxes between visitors. Everything else about the site — the items,
// the photos, the pages — is static content in this repo and works
// without it. Until you fill this in, the site still loads fine; the
// tick boxes are just disabled.
//
// You get this object from: Firebase Console -> Project settings (gear
// icon) -> General tab -> "Your apps" -> the web app (</>) -> SDK setup
// and config. Paste it exactly as shown there.
//
// It is safe for this to be public and committed to GitHub — it is not a
// secret key, it just tells the browser which Firebase project to talk
// to. The real protection is firestore.rules, not hiding this object.
//
// You only need Firestore. Do NOT enable Firebase Storage or
// Authentication — this site uses neither, and Storage is the part that
// asks for a paid plan.
// ----------------------------------------------------------------------
// storageBucket is deliberately left out of this object: the site uses
// Firebase Storage for nothing, and Storage is the piece that asks for a
// paid plan. Photos live in this repo's images/ folder instead.
export const firebaseConfig = {
  apiKey: "AIzaSyAs1L2zXGAkyb_tMhCVJfuWZlRhryoxc30",
  authDomain: "wishlist-6c084.firebaseapp.com",
  projectId: "wishlist-6c084",
  messagingSenderId: "384806804830",
  appId: "1:384806804830:web:63ec99d8e1d5e19b3203cf"
};
