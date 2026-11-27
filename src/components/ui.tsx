"use client";

import Link from "next/link";
import {
  useEffect, useId, useRef, type ComponentProps, type ReactNode,
} from "react";
import { AlertCircle, Check, Search, X } from "lucide-react";

function classes(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
};

export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={classes("ui-btn", `ui-btn--${variant}`, className)} {...props} />;
}

export function IconButton({ label, className, type = "button", ...props }: ComponentProps<"button"> & { label: string }) {
  return <button type={type} aria-label={label} className={classes("ui-icon-btn", className)} {...props} />;
}

export function TextLink({ href, className, ...props }: ComponentProps<"a"> & { href: string }) {
  return <Link href={href} className={classes("ui-text-link", className)} {...props} />;
}

type FieldOptions = { label?: string; hint?: string; error?: string };
function Field({ label, hint, error, id, children }: FieldOptions & { id: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {(error || hint) && <span id={`${id}-help`} className={error ? "ui-field-error" : "ui-field-hint"}>{error || hint}</span>}
    </div>
  );
}

function useField(id: string | undefined, { error, hint }: FieldOptions, describedBy?: string) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return {
    id: fieldId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": classes(describedBy, error || hint ? `${fieldId}-help` : undefined) || undefined,
  } as const;
}

type InputProps = ComponentProps<"input"> & FieldOptions;
export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const field = useField(id, { hint, error }, props["aria-describedby"]);
  return <Field {...{ label, hint, error, id: field.id }}>
    <input {...props} {...field} className={classes("ui-control", className)} />
  </Field>;
}

export function SearchInput({ label, hint, error, id, className, ...props }: InputProps) {
  const field = useField(id, { hint, error }, props["aria-describedby"]);
  return <Field {...{ label, hint, error, id: field.id }}>
    <div className="ui-search"><Search aria-hidden size={18} />
      <input type="search" aria-label={label ? undefined : "Поиск"} {...props} {...field} className={classes("ui-control", className)} />
    </div>
  </Field>;
}

export function Select({ label, hint, error, id, className, ...props }: ComponentProps<"select"> & FieldOptions) {
  const field = useField(id, { hint, error }, props["aria-describedby"]);
  return <Field {...{ label, hint, error, id: field.id }}>
    <select {...props} {...field} className={classes("ui-control", className)} />
  </Field>;
}

export function Textarea({ label, hint, error, id, className, ...props }: ComponentProps<"textarea"> & FieldOptions) {
  const field = useField(id, { hint, error }, props["aria-describedby"]);
  return <Field {...{ label, hint, error, id: field.id }}>
    <textarea {...props} {...field} className={classes("ui-control", className)} />
  </Field>;
}

const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
export function Price({ value, className }: { value: number; className?: string }) {
  return <span className={classes("ui-price", className)}>{rubles.format(value)}</span>;
}
export function ObjectNumber({ value, className }: { value: string; className?: string }) {
  return <span className={classes("ui-object-number", className)}>{value}</span>;
}

export type Tone = "neutral" | "success" | "warning" | "error" | "primary";
export function StatusTag({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={classes("ui-tag", `ui-tag--${tone}`, className)}>{children}</span>;
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={classes("ui-skeleton", className)} {...props} />;
}

type StateProps = { title: string; description?: string; action?: ReactNode };
export function EmptyState({ title, description, action }: StateProps) {
  return <div className="ui-state"><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
export function ErrorState({ title, description, action }: StateProps) {
  return <div className="ui-state ui-state-error" role="alert"><AlertCircle size={20} aria-hidden />
    <h3>{title}</h3>{description && <p>{description}</p>}{action}
  </div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <aside className="ui-toast"><Check aria-hidden size={20} /><span role="status">{message}</span>
    <IconButton label="Закрыть уведомление" onClick={onClose}><X size={18} aria-hidden /></IconButton>
  </aside>;
}

type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode };

function Overlay({ open, onClose, title, children, sheet }: DialogProps & { sheet?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={classes("ui-dialog", sheet ? "ui-sheet" : undefined)}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <div className="ui-dialog-heading"><h2 id={titleId}>{title}</h2><IconButton label="Закрыть" onClick={onClose}><X aria-hidden size={20} /></IconButton></div>
    {children}
  </dialog>;
}

export function Dialog(props: DialogProps) { return <Overlay {...props} />; }
export function BottomSheet(props: DialogProps) { return <Overlay {...props} sheet />; }
