"use client";
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';

function RequiredMark() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  return <span ref={ref} className="account-required" onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false); }}>
    <button type="button" aria-label="Обязательное поле" aria-expanded={open} aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onPointerDown={event => event.preventDefault()}
      onClick={() => setOpen(value => !value)}>*</button>
    {open && <span id={id} role="tooltip">Обязательное поле</span>}
  </span>;
}

export function AuthField({ label, hint, error, accessory, id, ...props }: ComponentProps<'input'> & {
  label: string; hint?: string; error?: string; accessory?: ReactNode;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [localError, setLocalError] = useState('');
  const message = error || localError;
  return <div className="ui-field account-field">
    <div className="account-label"><label htmlFor={fieldId}>{label}</label>{props.required && <RequiredMark />}{accessory}</div>
    <input {...props} id={fieldId} className="ui-control" aria-required={props.required || undefined}
      aria-invalid={Boolean(message)} aria-describedby={message || hint ? fieldId + '-help' : undefined}
      onBlur={event => { setLocalError(event.target.validity.valid ? '' : event.target.validity.valueMissing ? 'Заполните это поле.' : props.type === 'email' ? 'Проверьте адрес электронной почты.' : 'Проверьте введённое значение.'); props.onBlur?.(event); }}
      onInput={event => { if (event.currentTarget.validity.valid) setLocalError(''); props.onInput?.(event); }} />
    {(message || hint) && <span id={fieldId + '-help'} className={message ? 'ui-field-error' : 'ui-field-hint'}>{message || hint}</span>}
  </div>;
}

export function TelegramIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.8 3.1 18.5 20c-.2 1.2-.9 1.5-1.9.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.3L5.8 13.5.9 12c-1.1-.3-1.1-1.1.2-1.6L20.3 3c.9-.3 1.7.2 1.5.1Z" /></svg>;
}
