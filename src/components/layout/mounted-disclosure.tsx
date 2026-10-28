import { useEffect, useRef, type ReactNode } from "react";

/** Native details keeps editors mounted; hashes reveal every ancestor before scrolling. */
export function revealSection(element: HTMLElement | null) {
  if (!element) return;
  let parent: HTMLElement | null = element;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
}

export function MountedDisclosure({
  id,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function revealHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const target = document.getElementById(hash);
      if (!target || !ref.current?.contains(target)) return;
      revealSection(target);
      requestAnimationFrame(() => target.scrollIntoView?.({ block: "start" }));
    }
    revealHash();
    window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, []);
  return (
    <details
      ref={ref}
      id={id}
      open={defaultOpen || undefined}
      className="scroll-mt-20 border-b py-3"
    >
      <summary className="min-h-11 cursor-pointer content-center rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9">
        {title}
        {summary ? <span className="ml-3 font-normal text-muted-foreground">{summary}</span> : null}
      </summary>
      <div className="min-w-0 space-y-3 pt-3">{children}</div>
    </details>
  );
}
