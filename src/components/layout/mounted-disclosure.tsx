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
    if (defaultOpen && ref.current) ref.current.open = true;
  }, [defaultOpen]);
  useEffect(() => {
    function revealHash(hash = window.location.hash.slice(1)) {
      if (!hash) return;
      const target = document.getElementById(hash);
      if (!target || !ref.current?.contains(target)) return;
      revealSection(target);
      requestAnimationFrame(() => target.scrollIntoView?.({ block: "start" }));
    }
    function onHashChange() {
      revealHash();
    }
    function onAnchorClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        url.search !== window.location.search
      )
        return;
      // Preserve native/router navigation, including a repeated anchor that emits no hashchange.
      revealHash(url.hash.slice(1));
    }
    revealHash();
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onAnchorClick);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onAnchorClick);
    };
  }, []);
  return (
    <details ref={ref} id={id} className="scroll-mt-20 border-b py-3">
      <summary className="min-h-11 cursor-pointer content-center rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9">
        {title}
        {summary ? <span className="ml-3 font-normal text-muted-foreground">{summary}</span> : null}
      </summary>
      <div className="min-w-0 space-y-3 pt-3">{children}</div>
    </details>
  );
}
