'use client';

import type { ReactNode } from 'react';

export const INTEREST_EVENT = 'vora:interest';

/** Anchor to the demo form that also suggests a topic for the "interest" field. */
export function InterestLink({ interest, className, children }: { interest: string; className?: string; children: ReactNode }) {
  return (
    <a
      href="#contacto"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent<string>(INTEREST_EVENT, { detail: interest }))}
    >
      {children}
    </a>
  );
}
