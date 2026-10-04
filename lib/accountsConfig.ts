/**
 * Config for the BeaTrackFam accounts worker (workers/accounts/) — the
 * registry that lets a customer delete the app, reinstall it later, and
 * log in again with the same email instead of signing up again.
 *
 * The URL is the predictable workers.dev address for a worker named
 * `beatrackfam-accounts` on the same Cloudflare account as the other
 * BeaTrackFam workers. If the worker is ever deployed under a different
 * name/subdomain, update this one line. While the worker is
 * unreachable the app quietly falls back to device-local accounts, so
 * nothing breaks before it's deployed.
 *
 * The app secret is shared with the password-reset worker on purpose:
 * one guard value for Joey to set on both workers. It lives in
 * lib/resetConfig.ts — never copy its value anywhere else.
 */
import { RESET_APP_SECRET } from "./resetConfig";

export const ACCOUNTS_WORKER_URL =
  "https://beatrackfam-accounts.contact-beatrackfam.workers.dev";

export const ACCOUNTS_APP_SECRET = RESET_APP_SECRET;

export const isAccountSyncConfigured = () => ACCOUNTS_WORKER_URL.length > 0;
