"use client";

import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type DialogContextValue = { open: boolean; setOpen: (open: boolean) => void };
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog components must be nested in Dialog.");
  return context;
}

export function Dialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialog();
  return (
    <button type="button" onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDialogElement>) {
  const { open, setOpen } = useDialog();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      onClose={() => setOpen(false)}
      className={cn(
        "m-auto w-[min(92vw,30rem)] rounded-3xl border border-border bg-paper p-6 text-ink shadow-xl backdrop:bg-ink/50",
        className,
      )}
      {...props}
    >
      {children}
    </dialog>
  );
}

export function DialogClose({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialog();
  return (
    <button type="button" onClick={() => setOpen(false)} {...props}>
      {children}
    </button>
  );
}
