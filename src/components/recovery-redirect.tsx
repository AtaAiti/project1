"use client";

import { useEffect } from "react";

export function RecoveryRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname === "/admin/reset-password") return;
    const hash = new URLSearchParams(url.hash.slice(1));
    if (hash.get("type") === "recovery" || (["/", "/ru", "/en"].includes(url.pathname) && url.searchParams.has("code"))) {
      window.location.replace(`/admin/reset-password${url.search}${url.hash}`);
    }
  }, []);
  return null;
}
