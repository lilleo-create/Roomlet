import { createServer } from "node:net";
import { isMainThread } from "node:worker_threads";

// Reserve the preview port for the lifetime of the build. A second launcher cannot
// rewrite manifests or chunks currently being served from the same directory.
if (isMainThread && !process.env.NEXT_PRIVATE_UPGRADE_BUILD_CHILD) {
  const guard = createServer(socket => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      guard.once("error", reject);
      guard.listen(3211, "127.0.0.1", resolve);
    });
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      throw new Error("The Roomlet preview is already running or building on port 3211. Stop it before rebuilding.");
    }
    throw error;
  }
  guard.unref();
}

// Select a separate output directory. Only the embedded API process can enable
// demo data at request time.
process.env.ROOMLET_EMBEDDED_BUILD = "1";
