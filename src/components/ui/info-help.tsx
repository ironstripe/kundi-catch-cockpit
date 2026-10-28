import { Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const focused = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function changeOpen(next: boolean) {
    cancelClose();
    if (!next) pinned.current = false;
    setOpen(next);
  }
  function leave() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!pinned.current && !focused.current) setOpen(false);
      closeTimer.current = null;
    }, 150);
  }
  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Info: ${label}`}
          className="shrink-0 text-muted-foreground lg:size-6"
          onMouseEnter={() => { cancelClose(); setOpen(true); }}
          onMouseLeave={leave}
          onFocus={() => { focused.current = true; cancelClose(); setOpen(true); }}
          onBlur={() => { focused.current = false; leave(); }}
          onClick={(event) => {
            event.preventDefault();
            pinned.current = true;
            changeOpen(true);
          }}
        >
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-2rem)] text-sm"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={cancelClose}
        onMouseLeave={leave}
        onFocusCapture={() => { focused.current = true; cancelClose(); }}
        onBlurCapture={() => { focused.current = false; leave(); }}
        onEscapeKeyDown={() => changeOpen(false)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
