"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui/primitives";

const links = [
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
];

export function ProjectNavigation({ projectName }: { projectName?: string }) {
  const pathname = usePathname();
  const projectsActive = pathname === "/projects" || pathname.startsWith("/projects/");
  return (
    <>
      <aside className="product-sidebar" aria-label="Workspace navigation">
        <Link className="brand product-sidebar__brand" href="/projects">
          <BrandMark />
          <span>Taskfella</span>
        </Link>
        <nav className="product-sidebar__nav" aria-label="Primary navigation">
          <Link
            className={`product-nav-link ${projectsActive ? "active" : ""}`}
            href="/projects"
            aria-current={projectsActive ? "page" : undefined}
          >
            <span aria-hidden="true">▦</span>
            <span>Projects</span>
          </Link>
          <Link
            className={`product-nav-link ${pathname.startsWith("/settings") ? "active" : ""}`}
            href="/settings"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          >
            <span aria-hidden="true">⚙</span>
            <span>Settings</span>
          </Link>
          <Link
            className={`product-nav-link ${pathname.startsWith("/account") ? "active" : ""}`}
            href="/account"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
          >
            <span aria-hidden="true">○</span>
            <span>Account</span>
          </Link>
        </nav>
        <div className="product-sidebar__footer">
          <p className="eyebrow">Current board</p>
          <p>{projectName ?? "Choose a project"}</p>
        </div>
      </aside>
      <nav className="product-bottom-nav" aria-label="Mobile navigation">
        {links.map((link) => {
          const active =
            link.href === "/projects" ? projectsActive : pathname.startsWith(link.href);
          return (
            <Link
              className={active ? "active" : ""}
              href={link.href}
              key={link.href}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">
                {link.href === "/projects" ? "▦" : link.href === "/settings" ? "⚙" : "○"}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
