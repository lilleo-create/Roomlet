export function supabaseConfig() {
  // These clients run on the server. Read the deployment environment at request time.
  const url: unknown = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL");
  const key: unknown = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (typeof url !== "string" || !url || typeof key !== "string" || !key) {
    throw new Error("Задайте URL и publishable key проекта Supabase.");
  }
  return { url, key };
}
