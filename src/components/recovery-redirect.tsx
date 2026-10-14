"use client";

import { useEffect } from "react";

export function RecoveryRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname === "/admin/reset-password") return;
    const hash = new URLSearchParams(url.hash.slice(1));
    if (["recovery","invite"].includes(hash.get("type")||"") || (["/", "/ru", "/en"].includes(url.pathname) && url.searchParams.has("code"))) {
      window.location.replace(`/admin/reset-password${url.search}${url.hash}`);
    }
  }, []);
  return null;
}
