/**
 * Support contact config — where the Fam can be reached, and when.
 *
 * Human help runs through Shopify Inbox: customers chat from the
 * storefront chat widget (app/shop-chat.tsx) and the Fam reads and
 * replies in the Shopify Inbox app. Business hours come from the
 * BeaTrackFam Facebook Page (Staten Island, America/New_York):
 *   Mon–Thu 9 AM–10 PM · Fri 9 AM–3 PM · Sat closed · Sun 10 AM–10 PM
 * Keep this file in sync if the Page hours change.
 */

export const SUPPORT_EMAIL = "contact@beatrackfam.info";

/** Storefront home — the Shopify Inbox chat widget lives here. */
export const SHOP_CHAT_URL = "https://beatrackfam.info";

export const SUPPORT_TIMEZONE = "America/New_York";

export interface DayHours {
  /** "HH:MM" 24-hour, local to SUPPORT_TIMEZONE. */
  open: string;
  /** "HH:MM" 24-hour, local to SUPPORT_TIMEZONE. */
  close: string;
}

/** Keyed by JS getDay(): 0 = Sunday … 6 = Saturday. null = closed. */
export const BUSINESS_HOURS: Record<number, DayHours | null> = {
  0: { open: "10:00", close: "22:00" }, // Sunday
  1: { open: "09:00", close: "22:00" }, // Monday
  2: { open: "09:00", close: "22:00" }, // Tuesday
  3: { open: "09:00", close: "22:00" }, // Wednesday
  4: { open: "09:00", close: "22:00" }, // Thursday
  5: { open: "09:00", close: "15:00" }, // Friday
  6: null, // Saturday — closed
};

/** True once at least one day has hours posted. */
export const HOURS_CONFIGURED: boolean = Object.values(BUSINESS_HOURS).some(
  (d) => d !== null
);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

/** "09:00" → "9:00 AM" */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Day index (0=Sunday) + minutes since midnight in SUPPORT_TIMEZONE
 * for the given moment. Falls back to the device's local clock if
 * Intl time-zone support is unavailable.
 */
function zonedParts(now: Date): { day: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: SUPPORT_TIMEZONE,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday")
    );
    let hour = parseInt(get("hour"), 10);
    if (Number.isNaN(hour)) throw new Error("no hour");
    if (hour === 24) hour = 0; // some engines report midnight as 24
    const minute = parseInt(get("minute"), 10) || 0;
    return {
      day: dayIndex >= 0 ? dayIndex : now.getDay(),
      minutes: hour * 60 + minute,
    };
  } catch {
    return {
      day: now.getDay(),
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

/** Are we inside posted business hours right now? */
export function isOpenNow(now: Date = new Date()): boolean {
  if (!HOURS_CONFIGURED) return false;
  const { day, minutes } = zonedParts(now);
  const today = BUSINESS_HOURS[day];
  if (!today) return false;
  return minutes >= toMinutes(today.open) && minutes < toMinutes(today.close);
}

export interface NextOpening {
  /** 0 = later today, 1 = tomorrow, 2+ = that weekday. */
  dayOffset: number;
  dayName: string;
  /** "HH:MM" 24-hour. */
  open: string;
}

/** The next time we open, or null when nothing is posted. */
export function nextOpening(now: Date = new Date()): NextOpening | null {
  if (!HOURS_CONFIGURED) return null;
  const { day, minutes } = zonedParts(now);
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    const hrs = BUSINESS_HOURS[d];
    if (!hrs) continue;
    if (offset === 0 && minutes >= toMinutes(hrs.open)) continue;
    return { dayOffset: offset, dayName: DAY_NAMES[d], open: hrs.open };
  }
  return null;
}

/** "today at 9:00 AM" · "tomorrow at 10:00 AM" · "Monday at 9:00 AM" */
export function nextOpeningLabel(now: Date = new Date()): string | null {
  const next = nextOpening(now);
  if (!next) return null;
  const when =
    next.dayOffset === 0
      ? "today"
      : next.dayOffset === 1
        ? "tomorrow"
        : next.dayName;
  return `${when} at ${formatTime(next.open)}`;
}

/**
 * Compact hours for display, e.g.
 * "Mon–Thu 9:00 AM–10:00 PM · Fri 9:00 AM–3:00 PM · Sat closed · Sun 10:00 AM–10:00 PM".
 * Empty string when no hours are posted.
 */
export function hoursSummary(): string {
  if (!HOURS_CONFIGURED) return "";
  // Read the week starting Monday so the summary matches the Page.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; hrs: DayHours | null }[] = [];
  for (const d of order) {
    const hrs = BUSINESS_HOURS[d] ?? null;
    const last = groups[groups.length - 1];
    if (
      last &&
      ((last.hrs === null && hrs === null) ||
        (last.hrs !== null &&
          hrs !== null &&
          last.hrs.open === hrs.open &&
          last.hrs.close === hrs.close))
    ) {
      last.days.push(d);
    } else {
      groups.push({ days: [d], hrs });
    }
  }
  const short = (d: number) => DAY_NAMES[d].slice(0, 3);
  return groups
    .map(({ days, hrs }) => {
      const label =
        days.length > 1
          ? `${short(days[0])}–${short(days[days.length - 1])}`
          : short(days[0]);
      return hrs
        ? `${label} ${formatTime(hrs.open)}–${formatTime(hrs.close)}`
        : `${label} closed`;
    })
    .join(" · ");
}

/**
 * One-line status for chat surfaces: online / offline / unposted.
 * Copy stays neutral when no hours are configured.
 */
export function supportStatusLine(now: Date = new Date()): string {
  if (!HOURS_CONFIGURED) {
    return "We read every chat in Shopify Inbox — send us a message anytime.";
  }
  if (isOpenNow(now)) {
    return "We're online now — open the chat below and say hi.";
  }
  const next = nextOpeningLabel(now);
  return next
    ? `We're offline right now — we're back ${next}. Leave a chat and we'll reply then.`
    : "We're offline right now — leave a chat and we'll reply when we're back.";
}
