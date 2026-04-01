export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureTable } = await import("./lib/code-server-db");
    await ensureTable();
  }
}
