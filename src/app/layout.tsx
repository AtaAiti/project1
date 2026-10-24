import { headers } from "next/headers";
import { siteOrigin } from "@/lib/site-seo";
import type { Metadata } from "next";
import "./globals.css";
import { ConsentProvider } from "@/components/cookie-consent";
import { BookingDraftProvider } from "@/components/booking-draft";
import { RecoveryRedirect } from "@/components/recovery-redirect";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "ЛитераторЪ | Место встречи между строк",
  description: "Бар и клуб любителей чтения «ЛитераторЪ».",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await headers()).get("x-site-locale") === "en" ? "en" : "ru";
  return (
    <html lang={locale}>
      <body>
        <ConsentProvider>
          <BookingDraftProvider>
            <RecoveryRedirect />
            {children}
          </BookingDraftProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
