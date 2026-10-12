import type { Metadata } from "next";
import "./globals.css";
import { RecoveryRedirect } from "@/components/recovery-redirect";

export const metadata: Metadata = {
  title: "ЛитераторЪ | Место встречи между строк",
  description: "Бар и клуб любителей чтения «ЛитераторЪ».",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body><RecoveryRedirect />{children}</body>
    </html>
  );
}
