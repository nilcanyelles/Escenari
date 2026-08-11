"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!(await checkPassword(password))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(next && next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
