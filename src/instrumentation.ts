/** Runs once when the server starts. The worker lives in this process (no Redis); `ENABLE_WORKER=true` turns it on. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ENABLE_WORKER === "true") {
    const { startWorker } = await import("@/notifications/worker");
    startWorker();
  }
}
