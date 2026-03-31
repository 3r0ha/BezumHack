"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TooltipProviderContextValue {
  delayDuration: number;
}

const TooltipProviderContext = React.createContext<TooltipProviderContextValue>({
  delayDuration: 200,
});

export interface TooltipProviderProps {
  delayDuration?: number;
  children: React.ReactNode;
}

function TooltipProvider({
  delayDuration = 200,
  children,
}: TooltipProviderProps) {
  return (
    <TooltipProviderContext.Provider value={{ delayDuration }}>
      {children}
    </TooltipProviderContext.Provider>
  );
}

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
});

export interface TooltipProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Tooltip({
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement>(null!);
  const isOpen = open !== undefined ? open : internalOpen;

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (open === undefined) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [open, onOpenChange]
  );

  return (
    <TooltipContext.Provider
      value={{ open: isOpen, setOpen: handleOpenChange, triggerRef }}
    >
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, children, ...props }, ref) => {
  const { setOpen, triggerRef } = React.useContext(TooltipContext);
  const { delayDuration } = React.useContext(TooltipProviderContext);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, delayDuration);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...triggerProps,
      ref: (node: HTMLElement) => {
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        if (typeof ref === "function") ref(node as HTMLButtonElement);
        else if (ref)
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current =
            node as HTMLButtonElement;
      },
    });
  }

  return (
    <button
      ref={(node) => {
        (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }}
      type="button"
      className={className}
      {...triggerProps}
      {...props}
    >
      {children}
    </button>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    side?: "top" | "bottom" | "left" | "right";
    sideOffset?: number;
  }
>(({ className, side = "top", sideOffset = 4, children, ...props }, ref) => {
  const { open } = React.useContext(TooltipContext);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
        side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
        side === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
        side === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
