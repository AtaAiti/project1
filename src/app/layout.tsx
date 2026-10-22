import type { Metadata } from "next";
import "./globals.css";
import { ConsentProvider } from "@/components/cookie-consent";
import { BookingDraftProvider } from "@/components/booking-draft";
import { RecoveryRedirect } from "@/components/recovery-redirect";

export const metadata: Metadata = {
  title: "ЛитераторЪ | Место встречи между строк",
  description: "Бар и клуб любителей чтения «ЛитераторЪ».",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body><ConsentProvider><BookingDraftProvider><RecoveryRedirect />{children}</BookingDraftProvider></ConsentProvider></body>
    </html>
  );
}
