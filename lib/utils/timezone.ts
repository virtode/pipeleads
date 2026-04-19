import { startOfDay, endOfDay } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export function getStartOfDayUtc(timezone: string, now: Date = new Date()): Date {
  return fromZonedTime(startOfDay(toZonedTime(now, timezone)), timezone)
}

export function getEndOfDayUtc(timezone: string, now: Date = new Date()): Date {
  return fromZonedTime(endOfDay(toZonedTime(now, timezone)), timezone)
}
