"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    section: "GENERALE",
    links: [
      { href: "/", label: "Dashboard", icon: IconDashboard },
      { href: "/history", label: "Cronologia", icon: IconHistory },
    ],
  },
  {
    section: "TOOLS",
    links: [
      { href: "/#generate", label: "Nuovo Job", icon: IconSparkles },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-[220px] min-h-screen shrink-0"
      style={{
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
        >
          AI
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Infographic
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Amazon Tool
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section}>
            <p
              className="text-xs font-semibold tracking-widest px-2 mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: active ? "rgba(139,92,246,0.15)" : "transparent",
                        color: active ? "var(--purple-400)" : "var(--text-muted)",
                        borderLeft: active ? "2px solid var(--purple-500)" : "2px solid transparent",
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Version badge */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div
          className="rounded-lg px-3 py-2 text-xs text-center"
          style={{ background: "rgba(139,92,246,0.1)", color: "var(--purple-400)" }}
        >
          v0.1.0 — Preview
        </div>
      </div>
    </aside>
  );
}

/* Inline SVG icon components */
function IconDashboard({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconHistory({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function IconSparkles({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
      <path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z" />
    </svg>
  );
}
