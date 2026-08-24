"use client";

import { useState, useTransition } from "react";
import { setMyAttendanceAction } from "../actions";

export default function AttendanceButtons({
  concertId,
  current,
}: {
  concertId: string;
  current: "yes" | "no" | null;
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  function choose(next: "yes" | "no") {
    if (pending) return;
    setValue(next);
    startTransition(async () => {
      await setMyAttendanceAction(concertId, next);
    });
  }

  return (
    <div className="attendance-btns">
      <button
        className={"attendance-btn yes" + (value === "yes" ? " active" : "")}
        onClick={() => choose("yes")}
        type="button"
      >
        Hi seré
      </button>
      <button
        className={"attendance-btn no" + (value === "no" ? " active" : "")}
        onClick={() => choose("no")}
        type="button"
      >
        No puc
      </button>
    </div>
  );
}
