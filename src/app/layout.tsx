import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeController } from "@/components/theme/theme-controller";
import { resolveAuthenticatedAccount } from "@/server/http/authentication";
import { APPEARANCE_VALUES, type Appearance } from "@/server/modules/account/settings";
import { getAppearanceCookie, getAppearanceRevisionCookie } from "@/server/modules/auth/cookies";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taskfella — focused work, made personal",
  description: "Taskfella personal workspace with secure accounts and calm settings.",
};

interface InitialAppearance {
  preference: Appearance;
  authenticated: boolean;
  revision?: string;
}

async function resolveInitialAppearance(): Promise<InitialAppearance> {
  const request = new Request("http://taskfella.internal", {
    headers: new Headers(await headers()),
  });
  const cached = getAppearanceCookie(request);
  const cachedRevision = getAppearanceRevisionCookie(request);
  let authenticated: Awaited<ReturnType<typeof resolveAuthenticatedAccount>> = null;
  try {
    authenticated = await resolveAuthenticatedAccount(request);
  } catch {
    authenticated = null;
  }
  if (authenticated) {
    const preference = authenticated.account.appearance;
    return {
      preference: APPEARANCE_VALUES.includes(preference as Appearance)
        ? (preference as Appearance)
        : "system",
      authenticated: true,
      revision: authenticated.accountVersion,
    };
  }
  return { preference: cached ?? "system", authenticated: false, revision: cachedRevision };
}

function themeBootstrap(initialAppearance: InitialAppearance): string {
  return `
(function () {
  try {
    var serverPreference = ${JSON.stringify(initialAppearance.preference)};
    var serverOwnsPreference = ${initialAppearance.authenticated ? "true" : "false"};
    var match = document.cookie.match(/(?:^|;\\s*)taskfella_appearance=([^;]+)/);
    var preference = serverPreference;
    if (!serverOwnsPreference && match) {
      try {
        var cookiePreference = decodeURIComponent(match[1]);
        if (
          cookiePreference === "system" ||
          cookiePreference === "light" ||
          cookiePreference === "dark"
        ) {
          preference = cookiePreference;
        }
      } catch (_) {
        preference = serverPreference;
      }
    }
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = preference === "dark" || (preference !== "light" && systemDark) ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    var fallbackSystemDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var fallbackTheme =
      serverPreference === "dark"
        ? "dark"
        : serverPreference === "light"
          ? "light"
          : fallbackSystemDark
            ? "dark"
            : "light";
    document.documentElement.dataset.theme = fallbackTheme;
    document.documentElement.style.colorScheme = fallbackTheme;
  }
})();`;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialAppearance = await resolveInitialAppearance();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap(initialAppearance) }} />
      </head>
      <body>
        <ThemeController
          initialPreference={initialAppearance.preference}
          serverOwnsPreference={initialAppearance.authenticated}
          initialRevision={initialAppearance.revision}
        />
        {children}
      </body>
    </html>
  );
}
