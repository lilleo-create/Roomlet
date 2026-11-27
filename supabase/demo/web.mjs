import { createServer } from "node:http";

export async function startPreviewWeb(publishableKey) {
  const hostname = "127.0.0.1";
  const port = 3211;
  Object.assign(process.env, {
    NODE_ENV: "production",
    ROOMLET_EMBEDDED_BUILD: "1",
    ROOMLET_DEMO_MODE: "true",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54331",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  });
  Object.defineProperty(process, Symbol.for("roomlet.embedded.loopback"), { value: true });
  const next = (await import("next")).default;
  const nextServer = next({ dev: false, hostname, port });
  await nextServer.prepare();
  const handle = nextServer.getRequestHandler();
  const webServer = createServer((request, response) => {
    if (![`${hostname}:${port}`, `localhost:${port}`].includes(request.headers.host)) {
      response.writeHead(403).end();
      return;
    }
    return handle(request, response);
  });
  await new Promise((resolve, reject) => {
    webServer.once("error", reject).listen(port, hostname, resolve);
  });
  console.log(`Roomlet demo: http://${hostname}:${port}/`);
  console.log("Local maker credentials: .roomlet-demo/credentials.json");
  return async () => {
    webServer.close();
    await nextServer.close();
  };
}
