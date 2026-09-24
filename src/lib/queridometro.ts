import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";

export type QueridometroType = {
  key: string;
  emoji: string;
  label: string;
  description: string;
  connection_label: string | null;
  active: boolean;
  sort_order: number;
};

export type QueridometroResultRow = {
  to_profile_id: string;
  reaction_key: string;
  total: number;
};

const TIME_ZONE = "America/Fortaleza";

function zonedDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function isoFromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getQueridometroPeriod(now = new Date()) {
  const { year, month, day } = zonedDateParts(now);
  const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localCalendarDate.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekStartDate = new Date(localCalendarDate);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysSinceMonday);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

  return {
    weekStart: isoFromUtcDate(weekStartDate),
    weekEnd: isoFromUtcDate(weekEndDate),
    votingOpen: dayOfWeek !== 0,
    revealAvailable: dayOfWeek === 0,
  };
}

export function formatQueridometroWeek(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${formatter.format(start)} a ${formatter.format(end)}`;
}

export async function getEligibleQueridometroProfiles(supabase: SupabaseClient, now = new Date()) {
  const { year, month, day } = zonedDateParts(now);
  const sinceDate = new Date(Date.UTC(year, month - 1, day));
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 30);
  const since = isoFromUtcDate(sinceDate);

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("status", "finished")
    .gte("date", since);
  const eventIds = (events ?? []).map((event) => event.id);
  const presentByEvent = await getPresentProfileIdsByEvent(supabase, eventIds);
  const eligibleIds = new Set<string>();
  for (const profileIds of presentByEvent.values()) {
    for (const profileId of profileIds) eligibleIds.add(profileId);
  }
  if (!eligibleIds.size) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("status", "approved")
    .in("id", [...eligibleIds])
    .order("full_name");
  return profiles ?? [];
}

export function normalizeQueridometroResults(rows: unknown): QueridometroResultRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const item = row as { to_profile_id?: unknown; reaction_key?: unknown; total?: unknown };
    if (typeof item.to_profile_id !== "string" || typeof item.reaction_key !== "string") return [];
    return [{
      to_profile_id: item.to_profile_id,
      reaction_key: item.reaction_key,
      total: Number(item.total ?? 0),
    }];
  });
}
