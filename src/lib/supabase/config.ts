const previewURL = "http://127.0.0.1:54331";

export function localDemoEnabled() {
  // Only the embedded launcher issues this process-local capability after opening its loopback API.
  return Reflect.get(process, Symbol.for("roomlet.embedded.loopback")) === true
    && process.env.ROOMLET_DEMO_MODE === "true"
    && Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL") === previewURL;
}

export function supabaseConfig() {
  // These clients run on the server. Read the deployment environment at request time.
  const url: unknown = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL");
  const key: unknown = Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (typeof url !== "string" || !url || typeof key !== "string" || !key) {
    throw new Error("Задайте URL и publishable key проекта Supabase.");
  }
  if (url === previewURL && !localDemoEnabled()) throw new Error("Демонстрационная база доступна только в локальном предпросмотре.");
  return { url, key };
}
