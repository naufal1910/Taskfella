import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskfella — focused work, made personal",
  description: "Taskfella email and password account foundation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
