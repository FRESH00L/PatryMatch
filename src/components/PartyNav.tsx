'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, Heart, User } from 'lucide-react';

/** Bottom tab bar: deck / matches / profile — the only three screens. */
export default function PartyNav({
  partyCode,
  matchCount = 0,
}: {
  partyCode: string;
  matchCount?: number;
}) {
  const pathname = usePathname();
  const base = `/p/${partyCode}`;

  const tabs = [
    { href: `${base}/deck`, label: 'Swipuj', icon: Flame, badge: 0 },
    { href: `${base}/matches`, label: 'Matche', icon: Heart, badge: matchCount },
    { href: `${base}/profile`, label: 'Profil', icon: User, badge: 0 },
  ];

  return (
    <nav className="sticky bottom-0 z-40 mx-auto mt-4 w-full max-w-md">
      <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition ${
                active ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-500'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-violet-300' : ''}`} />
              {label}
              {badge > 0 && (
                <span className="absolute right-[22%] top-1.5 min-w-[18px] rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-[18px] text-zinc-950">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
