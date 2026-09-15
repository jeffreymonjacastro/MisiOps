"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/categorias", label: "Categorías" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="border-b border-line md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-5 py-4 md:py-6">
          <span
            aria-hidden
            className="h-5 w-5 rounded-full border-2 border-amber"
            style={{ borderRightColor: "transparent" }}
          />
          <span className="text-[15px] font-semibold tracking-tight">MisiOps</span>
        </div>
        <nav aria-label="Secciones" className="px-2 pb-3 md:pb-0">
          <ul className="flex gap-1 md:flex-col">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="flex-1 md:flex-none">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-[var(--radius-panel)] px-3 py-2 text-sm transition-colors ${
                      active ? "bg-raised text-text" : "text-muted hover:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="flex-1 px-5 py-6 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
