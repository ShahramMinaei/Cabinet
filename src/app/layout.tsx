import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "./globals.css";
import { WorkspaceProvider } from "@/features/workspace/provider";
import { Shell } from "@/components/shell";
import { publicAsset } from "@/lib/paths";
export const metadata: Metadata = {
  title: "کابینت | دستیار هوشمند آشپزخانه",
  description:
    "موجودی خانه، برنامه غذایی و فهرست خرید؛ همه در یک آشپزخانه مرتب.",
  icons: { icon: publicAsset("/icon.svg") },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <WorkspaceProvider>
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
