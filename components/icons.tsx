/** Icone a tratto (24×24, stroke currentColor) usate da menu e pulsanti. */
type P = { size?: number; className?: string };

function Svg({ size = 20, className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {children}
    </svg>
  );
}

export const IconGrid = (p: P) => (
  <Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}><path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-7.1 7.1a1.5 1.5 0 0 1-2.1 0Z" /><circle cx="8.3" cy="8.3" r="1.4" /></Svg>
);
export const IconBox = (p: P) => (
  <Svg {...p}><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></Svg>
);
export const IconSliders = (p: P) => (
  <Svg {...p}><path d="M5 20v-6M5 10V4M12 20v-8M12 8V4M19 20v-4M19 12V4M2.5 14h5M9.5 8h5M16.5 16h5" /></Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" /></Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></Svg>
);
export const IconArrowUpRight = (p: P) => (
  <Svg {...p}><path d="M7 17 17 7M9 7h8v8" /></Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" fill={filled ? "currentColor" : "none"} /></Svg>
);
export const IconFilter = (p: P) => (
  <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
);
export const IconCart = (p: P) => (
  <Svg {...p}><path d="M3 4h2.2l2.2 11h10.4L20 7.5H6.3" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>
);
export const IconSend = (p: P) => (
  <Svg {...p}><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5Z" /></Svg>
);
