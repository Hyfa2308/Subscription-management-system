/**
 * REVORA – cn() utility — merges Tailwind classes intelligently.
 * Combines clsx and tailwind-merge.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
