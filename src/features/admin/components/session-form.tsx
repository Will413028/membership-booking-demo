"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studioDateTime, studioInstant } from "@/lib/time/studio";

import { createClassSession, updateClassSession } from "../actions";
import type {
  ActionResult,
  AdminClass,
  CreateSessionInput,
  Session,
} from "../types";

type SessionFormProps = {
  classes: AdminClass[];
  session?: Session;
};

export function SessionForm({ classes, session }: SessionFormProps) {
  const router = useRouter();
  const initialClass =
    classes.find((item) => item.id === session?.classId) ?? classes[0];
  const [classId, setClassId] = useState(
    session?.classId ?? initialClass?.id ?? "",
  );
  const [instructorName, setInstructorName] = useState(
    session?.instructorName ?? initialClass?.instructorName ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  const chooseClass = (id: string) => {
    setClassId(id);
    setInstructorName(
      classes.find((item) => item.id === id)?.instructorName ?? "",
    );
  };

  const submit = async (formData: FormData) => {
    setPending(true);
    setStatus("");
    setErrors({});
    try {
      const startsAt = formData.get("startsAt");
      const endsAt = formData.get("endsAt");
      const input: CreateSessionInput = {
        classId,
        instructorName,
        startsAt: studioInstant(typeof startsAt === "string" ? startsAt : ""),
        endsAt: studioInstant(typeof endsAt === "string" ? endsAt : ""),
        capacity: Number(formData.get("capacity")),
      };
      const result: ActionResult<Session> = session
        ? await updateClassSession({ id: session.id, ...input })
        : await createClassSession(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setStatus(
          result.code === "FORBIDDEN"
            ? "You do not have admin access."
            : "Please fix the highlighted fields.",
        );
        return;
      }
      router.push("/admin/schedules");
      router.refresh();
    } catch {
      setStatus(
        "Unable to save this session. Check the studio times and try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <form action={submit} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="classId">Class</Label>
          <select
            className="min-h-11 w-full rounded-xl border border-border bg-paper px-3 text-ink"
            id="classId"
            onChange={(event) => chooseClass(event.target.value)}
            value={classId}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.instructorName}
              </option>
            ))}
          </select>
          {errors.classId && (
            <p className="text-sm text-coral">{errors.classId}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="startsAt">Starts (Asia/Taipei)</Label>
          <Input
            defaultValue={session ? studioDateTime(session.startsAt) : ""}
            id="startsAt"
            name="startsAt"
            required
            type="datetime-local"
          />
          {errors.startsAt && (
            <p className="text-sm text-coral">{errors.startsAt}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">Ends (Asia/Taipei)</Label>
          <Input
            defaultValue={session ? studioDateTime(session.endsAt) : ""}
            id="endsAt"
            name="endsAt"
            required
            type="datetime-local"
          />
          {errors.endsAt && (
            <p className="text-sm text-coral">{errors.endsAt}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            defaultValue={session?.capacity ?? 12}
            id="capacity"
            min={1}
            name="capacity"
            required
            type="number"
          />
          {errors.capacity && (
            <p className="text-sm text-coral">{errors.capacity}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="instructorName">Instructor</Label>
          <Input
            id="instructorName"
            name="instructorName"
            onChange={(event) => setInstructorName(event.target.value)}
            required
            value={instructorName}
          />
          {errors.instructorName && (
            <p className="text-sm text-coral">{errors.instructorName}</p>
          )}
        </div>
        {status && (
          <p aria-live="polite" className="text-sm text-coral md:col-span-2">
            {status}
          </p>
        )}
        <div className="md:col-span-2">
          <Button disabled={pending || !classes.length} type="submit">
            {pending ? "Saving…" : session ? "Save session" : "Create session"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
