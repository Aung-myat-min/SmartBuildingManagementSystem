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

### Setup

Copy `.env.example` to `.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*`
values from the Firebase console (Project settings → General → Your apps).

**These values are not secrets.** They ship in the client bundle by design and
identify the project rather than granting access to it. Authorisation lives in
`firestore.rules` and the console's authorised-domains list.

### Bootstrapping a project, once

The rules cannot bootstrap themselves: `allow create` on `/users` reads the
actor's own `/users` document to find their role, and before the first CEO
document exists there is no role to find. So the first documents go in while the
rules are still permissive, and the rules are published immediately after.

```bash
pnpm bootstrap        # three sign-in accounts + eight profile documents
pnpm rules:deploy     # lock it down — do not skip this
```

Run those the other way round and the bootstrap gets `PERMISSION_DENIED`; skip
the second and the database is open to the internet. `pnpm rules:deploy` needs
`npx firebase-tools login` first, or paste `firestore.rules` into the console
under Firestore → Rules → Publish.

Seeded accounts, all with the password `Password!2026` — change them before
anything real depends on this:

| Email | Role |
| --- | --- |
| `hnin.nwe@university.edu` | Office Staff (Building 216) |
| `elysha@university.edu` | Admin Manager |
| `daw.htun@university.edu` | CEO / Super Admin |

Two console steps that are easy to miss:

1. **Authentication → Settings → Authorised domains** must include wherever the
   app is served from, or sign-in is rejected.
2. **Authentication → Templates → Customise action URL** must point at
   `https://<host>/login/first-sign-in`, or password-reset links land on
   Firebase's generic page instead of this app's screen.

### Local — the emulator suite, optional

Needs Java (the Firestore emulator is a JVM process). Useful for working on the
rules without touching the live project.

```bash
pnpm emulators        # auth :9099 · firestore :8080 · UI :4000
pnpm seed             # the same accounts, via the Admin SDK
```

Point the app at them with `NEXT_PUBLIC_FIREBASE_EMULATORS=1` in `.env.local`;
no project config is needed in that mode.
