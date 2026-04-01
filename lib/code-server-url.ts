import { userSlug } from "./code-server-k8s";
import { getCodeServerProxyBaseUrl } from "./code-server-config";

export function buildUserCodeServerProxyUrl(
  userId: string,
  token: string,
): string {
  const slug = userSlug(userId);
  const proxyBase = getCodeServerProxyBaseUrl();
  return `${proxyBase}/u/${slug}/?token=${token}`;
}
