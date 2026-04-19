import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(first: string, last?: string | null): string {
  return `${first.charAt(0)}${last ? last.charAt(0) : ''}`.toUpperCase()
}

export function getFullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ')
}

export { formatDateFr as formatDate, formatDateTimeFr as formatDateTime } from '@/lib/utils/date'
