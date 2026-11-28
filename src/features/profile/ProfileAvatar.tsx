"use client";
import { useState } from 'react';
import { UserRound } from 'lucide-react';

export function ProfileAvatar({ src, className = 'profile-avatar' }: { src?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={className} aria-hidden="true">{src && failed !== src
    // The browser loads Telegram's verified HTTPS URL; never proxy it with a server secret.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
    : <UserRound size={24} strokeWidth={1.65} />}</span>;
}
