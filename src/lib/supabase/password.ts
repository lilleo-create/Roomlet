import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createRoomletClient } from "./server";
import {chooseGuest} from '@/lib/telegram/guest.server';

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
    redirect(area + "/login?error=" + (credentials ? "credentials" : "connection") + (area === "/studio" && form.get("next") === "demo" ? "&next=demo" : ""));
  }
  redirect(area === "/studio" && form.get("next") === "demo" ? "/demo" : area);
}

export async function endSession(destination: "/profile" | "/studio/login") {
  const client = await createRoomletClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Не удалось завершить сеанс. Попробуйте ещё раз.");
  // Both cookie namespaces can exist after linking from the web account.
  // Do not let logout reveal an older email session underneath the Mini App.
  const web=await createRoomletClient('web');
  const webResult=await web.auth.signOut({scope:'local'});
  if(webResult.error)throw Error('Не удалось завершить сеанс. Попробуйте ещё раз.');
  await chooseGuest(true);
  (await cookies()).delete("roomlet-environment");
  redirect(destination);
}
