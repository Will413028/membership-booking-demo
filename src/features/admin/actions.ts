"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";

import type {
  ActionResult,
  AdminCancelBookingResult,
  CreateSessionInput,
  Session,
  UpdateSessionInput,
} from "./types";

const dateString = z
  .string()
  .min(1, "A date and time is required.")
  .refine(
    (value) =>
      /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      Number.isFinite(Date.parse(value)),
    "Enter a valid date and time.",
  );

const sessionFields = z.object({
  classId: z.string().trim().min(1, "Select a class."),
  startsAt: dateString,
  endsAt: dateString,
  capacity: z.coerce
    .number()
    .int("Capacity must be a whole number.")
    .min(1, "Capacity must be at least 1.")
    .max(100, "Capacity cannot exceed 100."),
  instructorName: z.string().trim().min(1, "Instructor name is required."),
});

const createSessionSchema = sessionFields.superRefine((value, context) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End time must be after start time.",
    });
  }
});

const updateSessionSchema = createSessionSchema.extend({
  id: z.string().trim().min(1, "Session ID is required."),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

function authFailure(error: unknown): ActionResult<never> {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : "UNAUTHORIZED";
  return {
    ok: false,
    code: code === "FORBIDDEN" ? "FORBIDDEN" : "UNAUTHORIZED",
  };
}

function databaseFailure(
  error?: { message?: string } | null,
): ActionResult<never> {
  if (error?.message === "CAPACITY_BELOW_BOOKINGS") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { capacity: "Capacity cannot be below confirmed bookings." },
    };
  }
  return { ok: false, code: "DATABASE_ERROR" };
}

function mapSession(
  row: {
    id: string;
    class_id: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    active: boolean;
  },
  instructorName: string,
): Session {
  return {
    id: row.id,
    classId: row.class_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    active: row.active,
    instructorName,
  };
}

async function validClass(
  input: CreateSessionInput,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  allowedInactiveClassId?: string,
): Promise<ActionResult<{ instructorName: string }> | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, instructor_name, active")
    .eq("id", input.classId)
    .maybeSingle();
  const classRecord = data as {
    id: string;
    instructor_name: string;
    active: boolean;
  } | null;

  if (error) return databaseFailure();
  if (
    !classRecord ||
    (!classRecord.active && classRecord.id !== allowedInactiveClassId)
  ) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { classId: "Class not found." },
    };
  }
  if (classRecord.instructor_name !== input.instructorName) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: {
        instructorName: "Instructor does not match the selected class.",
      },
    };
  }
  return { ok: true, data: { instructorName: classRecord.instructor_name } };
}

function revalidateSchedules() {
  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/classes");
}

export async function createClassSession(
  input: CreateSessionInput,
): Promise<ActionResult<Session>> {
  const supabase = await createServerClient();
  try {
    await requireAdmin(supabase);
  } catch (error) {
    return authFailure(error);
  }

  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const classResult = await validClass(parsed.data, supabase);
  if (!classResult?.ok) return classResult ?? databaseFailure();

  const { data, error } = await supabase
    .from("class_sessions")
    .insert({
      class_id: parsed.data.classId,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      capacity: parsed.data.capacity,
    })
    .select("id, class_id, starts_at, ends_at, capacity, active")
    .single();
  if (error || !data) return databaseFailure(error);

  revalidateSchedules();
  return {
    ok: true,
    data: mapSession(
      data as Parameters<typeof mapSession>[0],
      classResult.data.instructorName,
    ),
  };
}

export async function updateClassSession(
  input: UpdateSessionInput,
): Promise<ActionResult<Session>> {
  const supabase = await createServerClient();
  try {
    await requireAdmin(supabase);
  } catch (error) {
    return authFailure(error);
  }

  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { data: existingSession, error: existingSessionError } = await supabase
    .from("class_sessions")
    .select("class_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (existingSessionError || !existingSession) return databaseFailure();

  const classResult = await validClass(
    parsed.data,
    supabase,
    (existingSession as { class_id: string }).class_id,
  );
  if (!classResult?.ok) return classResult ?? databaseFailure();

  const { data, error } = await supabase
    .from("class_sessions")
    .update({
      class_id: parsed.data.classId,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      capacity: parsed.data.capacity,
    })
    .eq("id", parsed.data.id)
    .select("id, class_id, starts_at, ends_at, capacity, active")
    .single();
  if (error || !data) return databaseFailure(error);

  revalidateSchedules();
  return {
    ok: true,
    data: mapSession(
      data as Parameters<typeof mapSession>[0],
      classResult.data.instructorName,
    ),
  };
}

export async function setSessionActive(input: {
  sessionId: string;
  active: boolean;
}): Promise<ActionResult<void>> {
  const supabase = await createServerClient();
  try {
    await requireAdmin(supabase);
  } catch (error) {
    return authFailure(error);
  }

  const parsed = z
    .object({
      sessionId: z.string().trim().min(1, "Session ID is required."),
      active: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { data, error } = await supabase
    .from("class_sessions")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.sessionId)
    .select("id")
    .maybeSingle();
  if (error || !data) return databaseFailure();

  revalidateSchedules();
  return { ok: true, data: undefined };
}

function cancellationFailure(code: string): AdminCancelBookingResult {
  if (code === "FORBIDDEN") {
    return { ok: false, code, message: "Admin access is required." };
  }
  if (
    code === "BOOKING_NOT_FOUND" ||
    code === "BOOKING_CANCELLED" ||
    code === "SESSION_STARTED"
  ) {
    return { ok: false, code, message: "Booking could not be cancelled." };
  }
  return {
    ok: false,
    code: "UNAUTHORIZED",
    message: "Admin access is required.",
  };
}

export async function cancelBookingAsAdmin(
  input: unknown,
): Promise<AdminCancelBookingResult> {
  const supabase = await createServerClient();
  try {
    await requireAdmin(supabase);
  } catch (error) {
    return cancellationFailure(
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "FORBIDDEN"
        ? "FORBIDDEN"
        : "UNAUTHORIZED",
    );
  }

  const parsed = z
    .object({ bookingId: z.string().trim().min(1) })
    .safeParse(input);
  if (!parsed.success) return cancellationFailure("BOOKING_NOT_FOUND");

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data.bookingId,
  });
  if (error) {
    const message = typeof error.message === "string" ? error.message : "";
    const code = [
      "BOOKING_NOT_FOUND",
      "BOOKING_CANCELLED",
      "SESSION_STARTED",
    ].find((value) => message.includes(value));
    return cancellationFailure(code ?? "UNAUTHORIZED");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row !== "object" ||
    typeof (row as { booking_id?: unknown }).booking_id !== "string"
  ) {
    return cancellationFailure("UNAUTHORIZED");
  }

  const booking = row as {
    booking_id: string;
    credits_remaining: number | null;
  };
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return {
    ok: true,
    bookingId: booking.booking_id,
    creditsRemaining: booking.credits_remaining,
  };
}
