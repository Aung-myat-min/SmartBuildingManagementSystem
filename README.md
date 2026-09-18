# Smart Building Monitoring

Facilities-operations dashboard for a three-building estate (CET333). Next.js 16
(App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui on Base UI · Biome.

The codebase map is [`CLAUDE.md`](CLAUDE.md); the full reference — build status,
every exported function, page-by-page behaviour and the known gaps — is
[`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md).

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`pnpm lint` runs Biome, `pnpm format` writes formatting, `pnpm build` produces a
production build. Verify a build by its **exit code** — "✓ Compiled successfully"
prints before the prerender step that can still fail.

## Firebase

Authentication and the `users` collection are real; every other collection is
still mock data in `src/lib/mock-data.ts`.

### Local — the emulator suite

Needs Java (the Firestore emulator is a JVM process) and the Firebase CLI
(`npx firebase-tools`, or install it globally).

```bash
pnpm emulators      # auth :9099 · firestore :8080 · UI :4000
pnpm seed           # three sign-in accounts + eight profile documents
```

Then point the app at them by putting this in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_EMULATORS=1
```

No project config is needed in emulator mode. The seed script is idempotent —
re-running reuses existing accounts rather than failing.

Seeded accounts, all with the password `Password!2026`:

| Email | Role |
| --- | --- |
| `hnin.nwe@university.edu` | Office Staff (Building 216) |
| `elysha@university.edu` | Admin Manager |
| `daw.htun@university.edu` | CEO / Super Admin |

### A real project

Copy `.env.example` to `.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*`
values from the Firebase console, with `NEXT_PUBLIC_FIREBASE_EMULATORS=0`.

**These values are not secrets.** They ship in the client bundle by design and
identify the project rather than granting access to it. Authorisation lives in
`firestore.rules` and the console's authorised-domains list.

Two console steps that are easy to miss:

1. **Authentication → Settings → Authorised domains** must include wherever the
   app is served from, or sign-in is rejected.
2. **Authentication → Templates → Customise action URL** must point at
   `https://<host>/login/first-sign-in`, or password-reset links land on
   Firebase's generic page instead of this app's screen.

The security rules cannot bootstrap themselves — `allow create` on `/users`
reads the actor's own `/users` document to find their role, and before the first
CEO document exists there is no role to find. For a real project, create the
three accounts and their documents by hand in the console the first time.

Deploy the rules with `npx firebase-tools deploy --only firestore:rules`.
