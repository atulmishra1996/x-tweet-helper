import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getConnectionStatus } from "@/lib/llm/google-local-proxy";

export const runtime = "nodejs";

export const GET = handle(async () => {
  await requireUser();
  const status = await getConnectionStatus();
  return ok(status);
});
