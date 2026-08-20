import type { Metadata } from "next";
import { ThemeController } from "@/components/theme/theme-controller";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskfella — focused work, made personal",
  description: "Taskfella personal workspace with secure accounts and calm settings.",
};

const themeBootstrap = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|;\\s*)taskfella_appearance=([^;]+)/);
    var preference = match ? decodeURIComponent(match[1]) : "system";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = preference === "dark" || (preference !== "light" && systemDark) ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
