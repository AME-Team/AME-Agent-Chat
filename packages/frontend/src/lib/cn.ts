import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind クラスマージ (shadcn/ui 標準パターン) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
