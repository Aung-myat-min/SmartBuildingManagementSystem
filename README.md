# Smart Building Monitoring

A facilities dashboard for a three-building estate (CET333). Staff watch
equipment and sensors, raise maintenance requests, and read the log book and
reports.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui on
Base UI · Firebase · Biome.

## Setup

You need **Node 20 or newer**, **pnpm**, and a **Google account** for Firebase.
It takes about ten minutes.

### 1. Get the code

```bash
git clone <repo-url>
cd smart-campus-management
pnpm install
```

### 2. Make a Firebase project

Go to [console.firebase.google.com](https://console.firebase.google.com) and
click **Add project**. Any name works. You can turn Google Analytics off.

Then turn on the two things this app uses:

- **Build → Authentication → Get started → Email/Password → Enable → Save**
- **Build → Firestore Database → Create database → Start in test mode →**
  pick a location → **Create**

> Test mode means anyone with your project's key can read and write the
> database. That is fine while you are building. See [Security](#security)
> before you show this to anyone.

### 3. Copy your project's settings

In the console: **Project settings** (the gear icon) **→ General → Your apps**.

Click the web icon `</>`, give the app any nickname, and click
**Register app**. You will see a `firebaseConfig` block. Keep that page open.

Now in the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` and copy each value across:

| In `.env.local` | From `firebaseConfig` |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

Leave `NEXT_PUBLIC_FIREBASE_EMULATORS=0`.

These values are **not secrets**. They are in the browser bundle by design.
They say which project to talk to; they do not grant access to it.

### 4. Fill the project with starting data

```bash
pnpm init:project
```

This makes one CEO account and the estate it manages:

- 3 buildings and 19 rooms
- 16 equipment types and 28 equipment units
- 2 sensor types and 17 sensors

It does **not** make any maintenance requests, log book entries, equipment
history or reports. Those appear when you use the app, so you start with a
clean record.

Running it twice is safe. It updates the same documents instead of making
copies, and signs in to the account if it already exists.

```bash
pnpm init:project --dry-run    # show what it would do, change nothing
pnpm init:project --reset      # delete the estate first, then write it again
```

To use your own email and password:

```bash
CEO_EMAIL=you@example.com CEO_PASSWORD=YourPassword1! CEO_NAME="Your Name" pnpm init:project
```

The password must be at least 6 characters — that is Firebase's rule.

### 5. Run it

```bash
pnpm dev
```

Open <http://localhost:3000> and sign in with the account from step 4. The
default is:

```
daw.htun@university.edu
Password!2026
```

## Making more accounts

Sign in as the CEO and go to **Administration → User Accounts → New account**.

The new person gets an email with a link to set their own password. **The email
address must be real and you must be able to open it** — otherwise the account
exists but nobody can ever sign in to it. A Gmail alias works well for testing:
`yourname+staff@gmail.com`, `yourname+admin@gmail.com`.

One console step is easy to miss. In **Authentication → Templates → Password
reset → Edit → Customise action URL**, set:

```
http://localhost:3000/login/first-sign-in
```

Without this, the link in the email goes to a Firebase page instead of this
app's screen.

There are three roles:

| Role | What they can do |
| --- | --- |
| Office Staff | One building. Raise requests, work on equipment. Sensors are read-only. |
| Admin Manager | The whole estate. Approve requests, act on sensors, manage accounts. |
| CEO / Super Admin | Everything, plus buildings and rooms. |

There is no role switcher. To see another role, sign in as it.

## Everyday commands

```bash
pnpm dev        # run the app
pnpm test       # run the tests
pnpm lint       # check formatting and code style
pnpm format     # fix formatting
pnpm build      # production build
```

Check a build by whether the command **succeeded**, not by the text it prints —
"✓ Compiled successfully" appears before a later step that can still fail.

## Security

The database is in **test mode**, which means it is open to anyone who has the
project key. The key is in the browser bundle, so that is effectively everyone.

The app does check roles — it hides and padlocks what you may not use — but
that check runs in the browser. It stops mistakes, not attackers.

To close it, publish the rules in `firestore.rules`:

```bash
npx firebase-tools login
pnpm rules:deploy
```

Or paste the file into the console under **Firestore → Rules → Publish**.

Do this before the project is shared, deployed, or marked.

## Deploying

Wherever you host it, add the site's address under **Authentication → Settings
→ Authorised domains**, or sign-in will be refused. Update the password-reset
action URL to the real host too.

## Where things are

| | |
| --- | --- |
| Pages | `src/app/(app)/<route>/page.tsx` |
| Types | `src/lib/types.ts` — read this first |
| Firestore | `src/lib/*-store.ts`, one per collection |
| Shared state | `src/lib/app-state.tsx` |
| Rules (pure logic) | `src/lib/derive.ts`, `reporting.ts`, `permissions.ts` |
| Starting data | `src/lib/mock-data.ts` |

More detail: [`docs/APPLICATION-FLOW.md`](docs/APPLICATION-FLOW.md) for what
each role may do, [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md) for the full
reference.

## Troubleshooting

**`No .env.local found`** — you skipped step 3, or you are not in the project
folder.

**`auth/invalid-api-key`** — a value in `.env.local` is wrong or has a stray
quote. Copy it again from the console.

**`auth/operation-not-allowed`** — Email/Password is not switched on in
Authentication → Sign-in method.

**`PERMISSION_DENIED`** — the rules are published but the data was never set
up. Run `pnpm init:project`, or check Firestore → Rules.

**The page is stuck on "Signing in…"** — the browser cannot reach Firestore.
Check the project id in `.env.local`, and that a Firestore database exists.

**Signing in does nothing** — add your host under Authentication → Settings →
Authorised domains.
