import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/document-language";
export const metadata: Metadata = {
  title: "Кабинет | ЛитераторЪ",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DocumentLanguage locale="ru" />
      {children}
    </>
  );
}
