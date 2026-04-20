"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  buildAuthPath,
  sanitizeInternalRedirectPath,
} from "@/lib/safe-redirect";

export default function AuthStatusActions() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const nextUrl = sanitizeInternalRedirectPath(
    pathname?.startsWith("/lessons") ? pathname : "/lessons",
  );

  if (isPending) {
    return null;
  }

  if (!session) {
    return (
      <Link href={buildAuthPath("/login", nextUrl)}>
        <button
          className="btn btn-primary"
          style={{ padding: "5px 12px", fontSize: 12 }}
          id="nav-login-btn"
        >
          Log In
        </button>
      </Link>
    );
  }

  return (
    <button
      className="btn btn-ghost"
      style={{ padding: "5px 12px", fontSize: 12 }}
      id="nav-logout-btn"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
      type="button"
    >
      Log Out
    </button>
  );
}
