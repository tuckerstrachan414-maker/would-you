# BIG IF — stats backend setup (one-time, ~5 minutes)

The app works fully without this; global percentages just stay hidden.
When you're ready for real stats:

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with your Google account.
2. "Add project" → name it `big-if` (any name works) → disable Google Analytics → Create.

## 2. Create the Firestore database
1. In the left sidebar: Build → Firestore Database → "Create database".
2. Pick the default location, start in **production mode**, Create.

## 3. Paste the security rules
In Firestore → Rules tab, replace everything with this, then Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /votes/{qid} {
      allow read: if true;
      // Only allow vote-shaped writes: every changed field grows by exactly 1.
      allow create: if request.resource.data.keys().hasOnly(['a','b','press','walk'])
        && request.resource.data.values().hasOnly([1]);
      allow update: if request.resource.data.diff(resource.data).affectedKeys().size() == 1
        && request.resource.data.keys().hasOnly(['a','b','press','walk']);
    }
  }
}
```

## 4. Get the web config
1. Project settings (gear icon) → "Your apps" → click the `</>` (web) icon.
2. Register app (nickname `big-if`, no hosting). It shows a config block.
3. You only need two values from it: `projectId` and `apiKey`.

## 5. Tell the app
In `app.js`, find `const STATS_BACKEND = null;` and change it to:

```js
const STATS_BACKEND = { projectId: "YOUR_PROJECT_ID", apiKey: "YOUR_API_KEY" };
```

(The apiKey is a public web key — safe to commit; the rules above are what
protect the data.)

That's it. Votes land in the `votes` collection, one doc per question id.

---
**DONE 2026-07-10** — project `big-if-tucker` created via firebase-tools CLI,
Firestore database live (nam5), rules deployed, config pasted into app.js
(`STATS_BACKEND`). Verified in-browser: votes increment, bogus fields rejected.
Nothing left to do here; kept for reference / rebuilding the project.
