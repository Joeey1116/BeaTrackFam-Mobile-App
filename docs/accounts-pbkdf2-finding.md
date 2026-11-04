# Accounts migration — password-hash compatibility finding (Nov 4, 2026)

**Verdict: NOT compatible. A direct import of synced KV registry records
into D1 `customer_accounts` would produce accounts nobody can log into
with. Do NOT copy `passwordHash`/`salt` across as-is.**

## Parameters, exact

### App side — device-local accounts + KV registry worker (retired Nov 2026)

Sources: `lib/accounts.ts` (old, deleted in this rebuild) and
`workers/accounts/worker.js` (same scheme, verified identical).

- Algorithm: **SHA-256, single round** — `SHA256_hex(salt_hex + "::" + password)`
  (UTF-8 of the literal string `"<salt>::<password>"`).
- Salt: **16 random bytes, hex-encoded** (32 lowercase hex chars).
  Generated with `expo-crypto` `getRandomBytesAsync(16)` in the app,
  `crypto.getRandomValues(new Uint8Array(16))` in the worker.
- Hash encoding: **lowercase hex, 64 chars** (raw SHA-256 digest).
- No iterations, no PBKDF2, no key stretching of any kind.
- KV record shape: key `acct:<lowercased email>` →
  `{ name, email, salt, passwordHash }`. Profile extras (addresses,
  interests, receipts) were never in the registry — device-local only.

Note: the task brief said "PBKDF2 parameters … from lib/accounts.ts".
There are none — the app never used PBKDF2. The finding stands on the
actual scheme above, not the brief's assumption.

### Site side — D1 `customer_accounts` (live, `prod-deploy/src/storefront-api.js`)

- Algorithm: **WebCrypto PBKDF2, digest SHA-256**.
- Iterations: **`PBKDF2_ITERATIONS = 10000`** in the shipped code.
  (The file's header comment still says "210k" as the intended budget
  and explains 10k as a Workers Free CPU workaround — the constant, not
  the comment, is what verifies passwords. If the backend ever raises
  the constant, stored hashes must be re-derived or dual-verified.)
- Salt: **16 random bytes, base64-encoded** (standard `btoa` base64,
  24 chars with padding).
- Derived key: **256 bits**, output **base64-encoded** (44 chars).
- Verification: `deriveBits(PBKDF2, salt, 10000, SHA-256)` over the
  UTF-8 password, constant-time base64 comparison.
- Session tokens (separate concern): random 32-byte hex token, only its
  SHA-256 hex stored in `customer_sessions`, 30-day expiry.

## Why direct import fails

1. Different algorithm (SHA-256 once vs PBKDF2-SHA-256 × 10,000).
2. Different salt encoding (hex vs base64) and different hash encoding
   (hex 64 chars vs base64 44 chars) — a copied row would not even
   pass the site's length check in `verifyPassword` (`hash.length !==
   hashB64.length` → false).
3. The site has no legacy-verification branch: `verifyPassword` only
   runs PBKDF2. A SHA-256 hash can never verify as a PBKDF2 hash.

## Import approach (PREPARED, NOT EXECUTED — no prod D1 writes made)

Row count could not be obtained read-only from this repo: the KV
namespace binding is not in `workers/accounts/` (no `wrangler.toml`
there, no namespace id recorded), and no authenticated
`wrangler kv:key list` access exists on this machine. Exact access
needed: Cloudflare API token (or dashboard) with Workers KV read on
the account holding the `beatrackfam-accounts` worker's namespace, or
the namespace id + a `wrangler` login.

Mapping if the rows are ever pulled (read-only export first):

| KV record field | D1 `customer_accounts` column | Notes |
|---|---|---|
| key `acct:<email>` | `email` (lowercased) | Dedupe case-insensitively; skip rows whose email already exists in D1 (site account wins). |
| `name` | `name` | Trim, max 100 chars (site truncates on signup). |
| — | `id` | Fresh `crypto.randomUUID()` per row. |
| — | `created_at` | Import timestamp (original creation time was not stored). |
| `salt`, `passwordHash` | **DO NOT COPY** | See options below. |

Validation before any import: (1) export row count + a count of
malformed rows (bad email, missing fields); (2) dry-run the mapping
against a staging D1 and assert every mapped row inserts; (3) after
import, spot-check that a migrated email's login behaves per the
chosen option — never by logging in as the user.

Two honest options for the passwords (backend decision, not app code):

- **Option A (recommended): transparent upgrade.** Backend adds a
  one-time legacy branch to login: if the account carries a legacy
  marker, verify `SHA256_hex(salt_hex + "::" + password)` against
  the stored legacy hash; on success, re-hash with PBKDF2, store the
  new `salt`/`password_hash`, and clear the marker. Users log in
  normally, once, and are migrated. Requires the legacy hash + salt
  stored on the row (new columns or a side table) — never in place of
  the PBKDF2 columns.
- **Option B (no backend change): reset-required import.** Import
  name/email only with a null/placeholder password hash that can
  never verify, and email each migrated user a reset link (or rely on
  Forgot Password). Every migrated user must reset before first
  site login. Simpler, but every migrated user hits friction.

## Known limit — device-local-only accounts

Accounts that never synced to the KV registry (created while the
registry worker was unreachable and never logged in again afterwards)
exist only in that phone's AsyncStorage. They cannot be migrated
centrally at all — there is no server copy to import. Fallback, as
shipped in this rebuild: the user re-registers on the site (same
email, if free) or uses Forgot Password if a site account already
exists for that email. On app upgrade, old local password hashes are
stripped from the device on first read (see `lib/accounts.ts`), so no
stale credential material lingers in the app.
