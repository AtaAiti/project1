"use client";
import NextLink, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
function NavigationFeedback() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(
    <div aria-hidden="true" className="navigation-progress" />,
    document.body,
  );
}
export default function FeedbackLink({
  children,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <NavigationFeedback />
    </NextLink>
  );
}
