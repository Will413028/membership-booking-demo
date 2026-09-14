import { createServerClient } from "@/lib/supabase/server";

import type {
  ClassSession,
  ClassSessionDetails,
  SessionFilters,
} from "./types";

type DatabaseClass = {
  name: string;
  category: string;
  level: string;
  description: string;
  instructor_name: string;
};

type DatabaseSession = {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  classes: DatabaseClass | DatabaseClass[];
};

const sessionSelect =
  "id, class_id, starts_at, ends_at, capacity, classes!inner(name, category, level, description, instructor_name, active)";

function toClassSession(
  session: DatabaseSession,
  confirmedCount: number,
): ClassSession {
  const classRecord = Array.isArray(session.classes)
    ? session.classes[0]
    : session.classes;
  if (!classRecord) {
    throw new Error("Class session is missing its class record.");
  }

  return {
    id: session.id,
    classId: session.class_id,
    className: classRecord.name,
    category: classRecord.category,
    level: classRecord.level,
    instructorName: classRecord.instructor_name,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    capacity: session.capacity,
    confirmedCount,
    remainingSpots: Math.max(session.capacity - confirmedCount, 0),
  };
}

async function confirmedCounts(
  sessionIds: string[],
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<Map<string, number> | null> {
  if (sessionIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("session_confirmed_booking_counts")
    .select("session_id, confirmed_count")
    .in("session_id", sessionIds);
  if (error || !data) {
    return null;
  }

  return new Map(
    (data as Array<{ session_id: string; confirmed_count: number }>).map(
      (count) => [count.session_id, count.confirmed_count],
    ),
  );
}

function laterOfNowAnd(value: string | undefined): string {
  const now = Date.now();
  const requested = value ? new Date(value).getTime() : Number.NaN;
  return new Date(
    Number.isFinite(requested) && requested > now ? requested : now,
  ).toISOString();
}

export async function listUpcomingSessions(
  filters: SessionFilters,
): Promise<ClassSession[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("class_sessions")
    .select(sessionSelect)
    .eq("active", true)
    .gt("starts_at", laterOfNowAnd(filters.startsAfter))
    .eq("classes.active", true);

  if (filters.category) {
    query = query.eq("classes.category", filters.category);
  }

  if (filters.level) {
    query = query.eq("classes.level", filters.level);
  }

  if (filters.startsBefore) {
    query = query.lte("starts_at", filters.startsBefore);
  }

  const { data, error } = await query.order("starts_at", { ascending: true });
  if (error || !data) {
    return [];
  }

  const sessions = data as unknown as DatabaseSession[];
  const counts = await confirmedCounts(
    sessions.map((session) => session.id),
    supabase,
  );
  if (!counts) {
    return [];
  }

  return sessions.map((session) =>
    toClassSession(session, counts.get(session.id) ?? 0),
  );
}

export async function getSessionDetails(
  sessionId: string,
): Promise<ClassSessionDetails | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(sessionSelect)
    .eq("id", sessionId)
    .eq("active", true)
    .gt("starts_at", new Date().toISOString())
    .eq("classes.active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const counts = await confirmedCounts([sessionId], supabase);
  if (!counts) {
    return null;
  }

  const session = toClassSession(
    data as unknown as DatabaseSession,
    counts.get(sessionId) ?? 0,
  );
  const classRecord = (data as unknown as DatabaseSession).classes;
  return {
    ...session,
    description: (Array.isArray(classRecord) ? classRecord[0] : classRecord)
      .description,
  };
}
