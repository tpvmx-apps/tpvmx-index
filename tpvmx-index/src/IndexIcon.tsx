import type { ReactNode } from "react";

/** Pictogramas lineales TPVMX. Exclusivamente presentación interna del INDEX. */
export type IndexIconName =
  | "gallery" | "calendar" | "copy" | "availability" | "shield"
  | "arrow-left" | "check" | "clock" | "briefcase" | "arrow-right";

const strokes: Record<IndexIconName, ReactNode> = {
  gallery: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m3 17 5.5-5 4 3 3.5-4L21 17" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M7 3v4m10-4v4M3 10h18M8 14h3m3 0h3m-9 4h3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  availability: <><rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M8 3v4m8-4v4M4 10h16m-12 6 2.5 2.5L16 13" /></>,
  shield: <><path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  "arrow-left": <><path d="M20 12H4m6-6-6 6 6 6" /></>,
  check: <><path d="m5 12 5 5 9-10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18m-11 0v2h4v-2" /></>,
  "arrow-right": <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
};

export function IndexIcon({ name, size = 20, className = "" }: { name: IndexIconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      {strokes[name]}
    </svg>
  );
}
