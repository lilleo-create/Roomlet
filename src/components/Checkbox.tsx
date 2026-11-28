"use client";

import { useId, type ComponentProps, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import './checkbox.css';

export function Checkbox({ children, id, className = '', ...props }: Omit<ComponentProps<'input'>, 'type' | 'children'> & { children: ReactNode }) {
  const generated = useId();
  const inputId = id ?? generated;
  return <label className={`roomlet-checkbox ${className}`} htmlFor={inputId}>
    <span className="roomlet-checkbox-control"><input {...props} id={inputId} type="checkbox" />
      <span className="roomlet-checkbox-box" aria-hidden><Check size={16} strokeWidth={2} /></span></span>
    <span className="roomlet-checkbox-copy">{children}</span>
  </label>;
}
