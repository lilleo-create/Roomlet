import "server-only";
import { redirect } from "next/navigation";
import { createRoomletClient } from "./server";

export async function passwordLogin(form: FormData, area: "/profile" | "/studio") {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 4096) {
    redirect(area + "/login?error=credentials");
  }
  const client = await createRoomletClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const credentials = error.status && error.status < 500 && error.status !== 429;
    redirect(area + "/login?error=" + (credentials ? "credentials" : "connection"));
  }
  redirect(area);
}

export async function endSession(destination: "/profile" | "/studio/login") {
  const client = await createRoomletClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Не удалось завершить сеанс. Попробуйте ещё раз.");
  redirect(destination);
}
