/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Duration and Date Helper Utilities
 * Comprehensive helper for duration calculations, formatting, and date formatting
 * Timezone: UTC+7 (Bangkok/Indochina Time)
 */

// ==================== INTERFACES ====================

export interface DurationResult {
  totalDays: number | null;
  remainingDays: number | null;
  overdueDays: number | null;
  isOverdue: boolean;
  progressPercentage: number | null;
}

export interface DateFormatOptions {
  includeTime?: boolean;
  timezoneOffset?: number; // Hours offset from UTC (default: 7 for UTC+7)
}

export interface FormatDatesOptions {
  timezoneOffset?: number; // Hours offset from UTC (default: 7)
  fieldsWithTime?: string[]; // Field names that should include time
  useDefaultRules?: boolean; // Use default rules for detecting time fields (default: true)
}

// ==================== DATE UTILITIES ====================

/**
 * Extract only the date part (ignore time) from a Date object
 * Adjusted for UTC+7 timezone (Bangkok/Indochina Time)
 * @param date - Date to extract date part from
 * @returns Date object with time set to 00:00:00 UTC (representing the calendar date in UTC+7)
 */
export function extractDateOnly(
  date: Date | string | null | undefined,
): Date | null {
  if (!date) return null;

  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) return null;

  // Adjust for UTC+7 timezone offset (add 7 hours)
  const timezoneOffset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
  const adjustedDate = new Date(dateObj.getTime() + timezoneOffset);

  // Return date with time set to 00:00:00 UTC
  // This represents the calendar date as it appears in UTC+7 timezone
  return new Date(
    Date.UTC(
      adjustedDate.getUTCFullYear(),
      adjustedDate.getUTCMonth(),
      adjustedDate.getUTCDate(),
    ),
  );
}

// ==================== DURATION CALCULATIONS ====================

/**
 * Calculate the number of days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between the dates (rounded up)
 */
export function calculateDaysBetween(
  startDate: Date | string | undefined,
  endDate: Date | string | undefined,
): number | null {
  const start = extractDateOnly(startDate);
  const end = extractDateOnly(endDate);

  if (!start || !end) return null;

  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate total duration between start and end dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days in the duration
 * @example
 * calculateDuration('2026-03-01', '2026-03-15') // 14 days
 */
export function calculateDuration(
  startDate: Date | string | undefined,
  endDate: Date | string | undefined,
): number | null {
  return calculateDaysBetween(startDate, endDate);
}

/**
 * Calculate remaining days until end date
 * @param endDate - End date
 * @param referenceDate - Reference date (defaults to today)
 * @returns Number of days remaining, or null if already past end date
 * @example
 * calculateRemainingDuration('2026-03-15') // Days until March 15, 2026
 */
export function calculateRemainingDuration(
  endDate: Date | string | undefined,
  referenceDate: Date | string | undefined = new Date(),
): number | null {
  const end = extractDateOnly(endDate);
  const reference = extractDateOnly(referenceDate);

  if (!end || !reference) return null;

  // If reference date is past end date, return 0
  if (reference > end) return 0;

  return Math.ceil(
    (end.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Calculate overdue days past the end date
 * @param endDate - End date
 * @param referenceDate - Reference date (defaults to today)
 * @returns Number of days overdue, or 0 if not overdue yet
 * @example
 * calculateOverdueDuration('2026-02-20') // Days since Feb 20, 2026 (if today is past that)
 */
export function calculateOverdueDuration(
  endDate: Date | string | null | undefined,
  referenceDate: Date | string | null | undefined = new Date(),
): number | null {
  const end = extractDateOnly(endDate);
  const reference = extractDateOnly(referenceDate);

  if (!end || !reference) return null;

  // If reference date is before or on end date, not overdue
  if (reference <= end) return 0;

  return Math.ceil(
    (reference.getTime() - end.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Check if a date range is overdue
 * @param endDate - End date
 * @param referenceDate - Reference date (defaults to today)
 * @returns True if reference date is past end date
 */
export function isOverdue(
  endDate: Date | string | null | undefined,
  referenceDate: Date | string | null | undefined = new Date(),
): boolean {
  const end = extractDateOnly(endDate);
  const reference = extractDateOnly(referenceDate);

  if (!end || !reference) return false;

  return reference > end;
}

/**
 * Calculate progress percentage based on elapsed time
 * @param startDate - Start date
 * @param endDate - End date
 * @param referenceDate - Reference date (defaults to today)
 * @returns Progress percentage (0-100), or null if dates are invalid
 */
export function calculateProgressPercentage(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  referenceDate: Date | string | null | undefined = new Date(),
): number | null {
  const start = extractDateOnly(startDate);
  const end = extractDateOnly(endDate);
  const reference = extractDateOnly(referenceDate);

  if (!start || !end || !reference) return null;

  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const elapsedDays = Math.ceil(
    (reference.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (totalDays <= 0) return 0;

  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}

/**
 * Calculate all duration metrics at once
 * @param startDate - Start date
 * @param endDate - End date
 * @param referenceDate - Reference date (defaults to today)
 * @returns Object containing all duration metrics
 * @example
 * calculateAllDurations('2026-02-15', '2026-03-15')
 * // Returns: { totalDays: 28, remainingDays: 16, overdueDays: 0, isOverdue: false, progressPercentage: 42.86 }
 */
export function calculateAllDurations(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  referenceDate: Date | string | null | undefined = new Date(),
): DurationResult {
  const start = extractDateOnly(startDate);
  const end = extractDateOnly(endDate);
  const reference = extractDateOnly(referenceDate);

  if (!start || !end || !reference) {
    return {
      totalDays: null,
      remainingDays: null,
      overdueDays: null,
      isOverdue: false,
      progressPercentage: null,
    };
  }

  const totalDays = calculateDuration(start, end);
  const remainingDays = calculateRemainingDuration(end, reference);
  const overdueDays = calculateOverdueDuration(end, reference);
  const isOverdueStatus = isOverdue(end, reference);
  const progressPercentage = calculateProgressPercentage(start, end, reference);

  return {
    totalDays,
    remainingDays,
    overdueDays,
    isOverdue: isOverdueStatus,
    progressPercentage,
  };
}

// ==================== DURATION TEXT FORMATTING ====================

/**
 * Format total days into readable duration text
 * @param days - Total number of days (can be any type, will be coerced to number)
 * @returns Formatted duration string (e.g., "1M 2W 3D")
 * @example
 * formatDurationText(334) // "11M" (for 334 days)
 * formatDurationText(45) // "6W 3D"
 * formatDurationText(10) // "1W 3D"
 */
export function formatDurationText(days: any): string {
  const numDays = typeof days === "number" ? days : Number(days);
  if (!Number.isFinite(numDays) || numDays < 0) return "0D";

  const absDays = Math.ceil(numDays);

  // For short durations, just show days and weeks
  if (absDays < 30) {
    const weeks = Math.floor(absDays / 7);
    const remainingDays = absDays % 7;

    const parts: string[] = [];
    if (weeks > 0) parts.push(`${weeks}W`);
    if (remainingDays > 0) parts.push(`${remainingDays}D`);

    return parts.length > 0 ? parts.join(" ") : "0D";
  }

  // For longer durations, use more accurate month calculation
  // Average month = 30.44 days

  // Calculate estimated months (more accurate for calendar months)
  const estimatedMonths = Math.round(absDays / 30.44);

  // If we're very close to a whole month (within 2 days), round to that month
  const daysPerMonth = 30.44;
  const remainingAfterMonths = absDays - estimatedMonths * daysPerMonth;

  if (Math.abs(remainingAfterMonths) < 3) {
    // Very close to exact months, just return months
    return `${estimatedMonths}M`;
  }

  // Otherwise, break down into months, weeks, and days
  const months = Math.floor(absDays / daysPerMonth);
  const daysInCalculatedMonths = Math.round(months * daysPerMonth);
  const daysAfterMonths = absDays - daysInCalculatedMonths;

  const weeks = Math.floor(daysAfterMonths / 7);
  const finalDays = Math.round(daysAfterMonths % 7);

  const parts: string[] = [];
  if (months > 0) parts.push(`${months}M`);
  if (weeks > 0) parts.push(`${weeks}W`);
  if (finalDays > 0) parts.push(`${finalDays}D`);

  return parts.length > 0 ? parts.join(" ") : "0D";
}

/**
 * Parse human-readable duration text to total days
 * @param durationText - Duration string (e.g., "1M 2W 3D")
 * @returns Total number of days
 * @example
 * parseDurationText("11M") // ~334 days
 * parseDurationText("1M 2W 3D") // ~65 days
 * parseDurationText("2W 5D") // 19 days
 */
export function parseDurationText(durationText: string): number {
  if (!durationText || typeof durationText !== "string") return 0;

  const regex = /(\d+)\s*([MWD])/gi;
  let totalDays = 0;
  let match: RegExpExecArray | null;

  // Constants for conversion
  const DAYS_PER_MONTH = 30.44;
  const DAYS_PER_WEEK = 7;

  while ((match = regex.exec(durationText)) !== null) {
    const value = Number(match[1]);
    const unit = match[2].toUpperCase();

    if (unit === "M") {
      totalDays += value * DAYS_PER_MONTH;
    } else if (unit === "W") {
      totalDays += value * DAYS_PER_WEEK;
    } else if (unit === "D") {
      totalDays += value;
    }
  }

  return Math.round(totalDays);
}

// ==================== DATE FORMATTING ====================

/**
 * Format a date to DD-Mon-YYYY or DD-Mon-YYYY HH:MM format
 * @param date - Date object, ISO string, or date string
 * @param options - Formatting options
 * @returns Formatted date string
 * @example
 * formatDate('2026-02-27T03:16:40.149Z', { includeTime: false }) // "27-Feb-2026"
 * formatDate('2026-02-27T03:16:40.149Z', { includeTime: true }) // "27-Feb-2026 10:16"
 */
export function formatDate(
  date: Date | string | null | undefined,
  options: DateFormatOptions = {},
): string | null {
  if (!date) return null;

  const { includeTime = false, timezoneOffset = 7 } = options;

  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn("[formatDate] Invalid date:", date);
    return null;
  }

  // Convert absolute instant to target UTC offset (independent from server local timezone)
  const targetTime = new Date(dateObj.getTime() + timezoneOffset * 3600000);

  // Extract date components
  const day = targetTime.getUTCDate().toString().padStart(2, "0");
  const month = targetTime.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const year = targetTime.getUTCFullYear();

  // Format: DD-Mon-YYYY (e.g., "27-Feb-2026")
  const dateString = `${day}-${month}-${year}`;

  if (includeTime) {
    const hours = targetTime.getUTCHours().toString().padStart(2, "0");
    const minutes = targetTime.getUTCMinutes().toString().padStart(2, "0");
    // Format: DD-Mon-YYYY HH:MM (e.g., "27-Feb-2026 10:16")
    return `${dateString} ${hours}:${minutes}`;
  }

  return dateString;
}

/**
 * Format a date to DD-Mon-YYYY format (date only)
 * @param date - Date object, ISO string, or date string
 * @param timezoneOffset - Hours offset from UTC (default: 7)
 * @returns Formatted date string (DD-Mon-YYYY)
 * @example formatDateOnly('2026-02-27T03:16:40.149Z') // "27-Feb-2026"
 */
export function formatDateOnly(
  date: Date | string | undefined,
  timezoneOffset: number = 7,
): string | null {
  return formatDate(date, { includeTime: false, timezoneOffset });
}

/**
 * Format a date to DD-Mon-YYYY HH:MM format (date with time)
 * @param date - Date object, ISO string, or date string
 * @param timezoneOffset - Hours offset from UTC (default: 7)
 * @returns Formatted date string (DD-Mon-YYYY HH:MM)
 * @example formatDateTime('2026-02-27T03:16:40.149Z') // "27-Feb-2026 10:16"
 */
export function formatDateTime(
  date: Date | string | undefined,
  timezoneOffset: number = 7,
): string | null {
  return formatDate(date, { includeTime: true, timezoneOffset });
}

/**
 * Format a date to HH:MM format (time only)
 * @param date - Date object, ISO string, or date string
 * @param timezoneOffset - Hours offset from UTC (default: 7)
 * @returns Formatted time string (HH:MM)
 * @example formatTimeOnly('2026-02-27T03:16:40.149Z') // "10:16"
 */
export function formatTimeOnly(
  date: Date | string | null | undefined,
  timezoneOffset: number = 7,
): string | null {
  if (!date) return null;

  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    console.warn("[formatTimeOnly] Invalid date:", date);
    return null;
  }

  const targetTime = new Date(dateObj.getTime() + timezoneOffset * 3600000);

  const hours = targetTime.getUTCHours().toString().padStart(2, "0");
  const minutes = targetTime.getUTCMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

/**
 * Format a date to HH:MM:SS format (time with seconds)
 * @param date - Date object, ISO string, or date string
 * @param timezoneOffset - Hours offset from UTC (default: 7)
 * @returns Formatted time string (HH:MM:SS)
 * @example formatTimeOnlyWithSec('2026-02-27T03:16:40.149Z') // "10:16:40"
 */
export function formatTimeOnlyWithSec(
  date: Date | string | null | undefined,
  timezoneOffset: number = 7,
): string | null {
  if (!date) return null;

  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    console.warn("[formatTimeOnlyWithSec] Invalid date:", date);
    return null;
  }

  const targetTime = new Date(dateObj.getTime() + timezoneOffset * 3600000);

  const hours = targetTime.getUTCHours().toString().padStart(2, "0");
  const minutes = targetTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = targetTime.getUTCSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export const formatTimeOnlyithSec = formatTimeOnlyWithSec;

/**
 * Format dates in an object or array recursively
 * Automatically detects date fields and formats them accordingly
 * @param obj - Object or array to format
 * @param options - Formatting options or timezone offset (for backward compatibility)
 * @returns Formatted object with dates converted to strings
 * @example
 * // Using default rules
 * formatDatesInObject(data) // from_date, to_date, *_at get time
 *
 * // Custom fields with time
 * formatDatesInObject(data, { fieldsWithTime: ['start_date', 'end_date'] })
 *
 * // Disable default rules and use only custom fields
 * formatDatesInObject(data, { fieldsWithTime: ['deadline'], useDefaultRules: false })
 */
export function formatDatesInObject(
  obj: any,
  options?: FormatDatesOptions | number,
): any {
  // Handle backward compatibility: if options is a number, treat it as timezoneOffset
  const opts: FormatDatesOptions =
    typeof options === "number" ? { timezoneOffset: options } : options || {};

  const {
    timezoneOffset = 7,
    fieldsWithTime = [],
    useDefaultRules = true,
  } = opts;

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return formatDate(obj, { includeTime: false, timezoneOffset });
  }

  // Handle ISO date strings
  if (typeof obj === "string") {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoDateRegex.test(obj)) {
      return formatDate(obj, { includeTime: false, timezoneOffset });
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => formatDatesInObject(item, opts));
  }

  // Handle objects
  if (typeof obj === "object") {
    const formatted: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      // Determine if this field should include time
      let shouldIncludeTime = false;

      // Check custom fields first
      if (fieldsWithTime.includes(key)) {
        shouldIncludeTime = true;
      }
      // Apply default rules if enabled
      else if (useDefaultRules) {
        shouldIncludeTime =
          key === "from_date" ||
          key === "to_date" ||
          key.endsWith("_at") ||
          key === "created_at" ||
          key === "updated_at";
      }

      // Check if this is a date field
      const isDateField =
        key.includes("date") ||
        key.includes("time") ||
        key === "created_at" ||
        key === "updated_at" ||
        key === "last_updated";

      if (isDateField && (value instanceof Date || typeof value === "string")) {
        // Try to parse and format
        if (typeof value === "string") {
          const isoDateRegex =
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
          if (isoDateRegex.test(value)) {
            formatted[key] = formatDate(value, {
              includeTime: shouldIncludeTime,
              timezoneOffset,
            });
          } else {
            formatted[key] = formatDatesInObject(value, opts);
          }
        } else if (value instanceof Date) {
          formatted[key] = formatDate(value, {
            includeTime: shouldIncludeTime,
            timezoneOffset,
          });
        } else {
          formatted[key] = formatDatesInObject(value, opts);
        }
      } else {
        // Recursively process nested objects/arrays
        formatted[key] = formatDatesInObject(value, opts);
      }
    }

    return formatted;
  }

  return obj;
}

/**
 * Format a date to separate date and time components for expiry fields
 * @param date - Date object, ISO string, or date string
 * @param timezoneOffset - Hours offset from UTC (default: 7)
 * @returns Object with expiryDate (YYYY-MM-DD) and expiryTime (HH:mm:ss.SSS)
 * @example
 * formatExpiryDateTime('2026-02-27T03:16:40.149Z')
 * // Returns: { expiryDate: "2026-02-27", expiryTime: "10:16:40.149" }
 */
export function formatExpiryDateTime(
  date: Date | string | null | undefined,
  timezoneOffset: number = 7,
): { date: string | null; time: string | null } | null {
  if (!date) return null;

  let dateObj: Date;

  if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    console.warn("[formatExpiryDateTime] Invalid date:", date);
    return null;
  }

  // Convert absolute instant to target UTC offset (independent from server local timezone)
  const targetTime = new Date(dateObj.getTime() + timezoneOffset * 3600000);

  // Format date as YYYY-MM-DD
  const year = targetTime.getUTCFullYear();
  const month = (targetTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = targetTime.getUTCDate().toString().padStart(2, "0");
  const expiryDate = `${year}-${month}-${day}`;

  // Format time as HH:mm:ss.SSS
  const hours = targetTime.getUTCHours().toString().padStart(2, "0");
  const minutes = targetTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = targetTime.getUTCSeconds().toString().padStart(2, "0");
  const milliseconds = targetTime
    .getUTCMilliseconds()
    .toString()
    .padStart(3, "0");
  const expiryTime = `${hours}:${minutes}:${seconds}.${milliseconds}`;

  return { date: expiryDate, time: expiryTime };
}

/**
 * Calculates the expiry date and remaining time for the 1-hour edit lock.
 * @param createdAt - The timestamp of the creation
 * @param lockDurationMinutes - Default is 60 minutes
 * @returns Object containing the expiry Date and remaining milliseconds
 */
export function calculateEditExpiry(
  createdAt: Date | string | null | undefined,
  lockDurationMinutes: number = 60,
): { expiryDate: Date | null; remainingMs: number } {
  if (!createdAt) return { expiryDate: null, remainingMs: 0 };

  const createdAtDate =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;

  if (isNaN(createdAtDate.getTime())) {
    return { expiryDate: null, remainingMs: 0 };
  }

  // 1. Calculate Expiry (Created At + 60 Minutes)
  const expiryDate = new Date(
    createdAtDate.getTime() + lockDurationMinutes * 60000,
  );

  // 2. Calculate Remaining Time
  const now = new Date();
  const remainingMs = expiryDate.getTime() - now.getTime();

  return {
    expiryDate,
    remainingMs: Math.max(0, remainingMs), // Ensure we don't return negative time
  };
}

/**
 * Convert seconds to human-readable time (e.g., 600 -> "10m", 5400 -> "1h 30m")
 * @param seconds - Total seconds to format
 * @returns Formatted string (Xh Ym)
 */
export function formatSecondsToTime(seconds: number): string {
  if (seconds <= 0) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "0m";
}

/**
 * Format a raw database time string (e.g., "03:07:45.521406" or "14:30:00") into frontend time
 * @param timeStr - Raw time string from the database
 * @param includeSeconds - Whether to retain the seconds block (default: false)
 * @returns Formatted time string (e.g., "03:07" or "03:07:45")
 * @example
 * formatDbTimeTo("03:07:45.521406") // "03:07"
 * formatDbTimeTo("03:07:45.521406", true) // "03:07:45"
 */
export function formatDbTime(
  timeStr: string | null | undefined,
  includeSeconds = false,
): string | null {
  if (!timeStr || typeof timeStr !== "string") return null;

  // Extract the core time elements before any fractional dot separator
  const [mainTime] = timeStr.split(".");
  const timeParts = mainTime.split(":"); // ["03", "07", "45"]

  if (timeParts.length < 2) {
    console.error("[formatDbTimeTo] Unexpected format:", timeStr);
    return null;
  }

  const hours = timeParts[0].padStart(2, "0");
  const minutes = timeParts[1].padStart(2, "0");

  if (includeSeconds && timeParts[2]) {
    const seconds = timeParts[2].padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}`;
}

/**
 * Format a date into a clean, human-readable frontend format (e.g., "1 Jun, 2026")
 * Strips leading zeros from the day component and adds standard punctuation.
 * @param dateInput - Date object, ISO string, or raw date string
 * @returns Formatted date string (e.g., "1 Jun, 2026") or raw fallback string if invalid
 * @example
 * formatReadableDate("2026-06-01") // "1 Jun, 2026"
 * formatReadableDate("2026-07-31") // "31 Jul, 2027"
 */
export function formatReadableDate(dateInput: Date | string): string {
  const baseFormatted = formatDateOnly(dateInput);
  if (!baseFormatted) return String(dateInput);

  const parts = baseFormatted.split("-");
  if (parts.length !== 3) return baseFormatted;

  const day = parseInt(parts[0], 10).toString();
  const month = parts[1];
  const year = parts[2];

  return `${day} ${month}, ${year}`;
}

/**
 * Normalizes and parses raw day inputs into an array of standardized, lowercase day strings.
 * Handles string ranges (e.g., "mon-fri"), explicit conjunctions ("and", "&"), and mixed formatting.
 *
 * @param dayInput - A raw day string, array of strings, or a nullish database value
 * @returns An array of cleaned, lowercase short day identifiers (e.g., ["mon", "tue"])
 * @example
 * parseDays("Mon - Fri")        // ["mon", "tue", "wed", "thu", "fri"]
 * parseDays("Mon & Wed")        // ["mon", "wed"]
 * parseDays("Mon, Tue, Thu")    // ["mon", "tue", "thu"]
 * parseDays(["Mon", "Tue "])    // ["mon", "tue"]
 */
export function parseDays(dayInput: string | string[]): string[] {
  if (!dayInput) return [];
  if (Array.isArray(dayInput)) {
    return dayInput.map((d) => String(d).trim().toLowerCase());
  }

  const dayStr = String(dayInput)
    .toLowerCase()
    .replace(/\band\b/g, ",")
    .replace(/&/g, ",")
    .trim();

  if (dayStr === "mon - fri" || dayStr === "mon-fri")
    return ["mon", "tue", "wed", "thu", "fri"];
  if (dayStr === "mon - sat" || dayStr === "mon-sat")
    return ["mon", "tue", "wed", "thu", "fri", "sat"];

  if (dayStr.includes(","))
    return dayStr
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
  if (dayStr.includes(" "))
    return dayStr
      .split(/\s+/)
      .map((d) => d.trim())
      .filter(Boolean);

  return [dayStr];
}

/**
 * Formats an array of raw schedule blocks into a standardized, reader-friendly string summary.
 * Aggregates all days, deduplicates them, sorts them chronologically from Monday to Sunday,
 * and collapses continuous sequences of 3 or more days into a readable range.
 *
 * @param schedules - An array of objects, each containing a raw `day_of_week` string
 * @returns A formatted string label summary of the active days (e.g., "Mon - Fri" or "Tue & Thu")
 * @example
 * buildClassDayLabel([{ day_of_week: 'mon' }, { day_of_week: 'wed' }, { day_of_week: 'fri' }])
 * returns "Mon & Wed & Fri"
 * * buildClassDayLabel([{ day_of_week: 'fri' }, { day_of_week: 'mon' }, { day_of_week: 'wed' }, { day_of_week: 'thu' }, { day_of_week: 'tue' }])
 * returns "Mon - Fri"
 * * buildClassDayLabel([{ day_of_week: 'tue' }])
 * returns "Tue"
 */
export function buildClassDayLabel(
  schedules: Array<{ day_of_week: string }>,
): string {
  if (!schedules || schedules.length === 0) return "";

  const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DISPLAY_MAP: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };

  // 1. Sanitize, filter duplicates, and sort based on standard week order
  const uniqueDays = Array.from(
    new Set(schedules.map((s) => s.day_of_week.toLowerCase().trim())),
  ).sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));

  if (uniqueDays.length === 0) return "";
  if (uniqueDays.length === 1) return DISPLAY_MAP[uniqueDays[0]] || "";

  // 2. Evaluate if the whole sequence is perfectly continuous
  const startIdx = WEEK_ORDER.indexOf(uniqueDays[0]);
  const endIdx = WEEK_ORDER.indexOf(uniqueDays[uniqueDays.length - 1]);
  const isContinuous = endIdx - startIdx === uniqueDays.length - 1;

  // If continuous and 3+ days, return a range format (e.g., "Mon - Fri")
  if (isContinuous && uniqueDays.length >= 3) {
    return `${DISPLAY_MAP[uniqueDays[0]]} - ${DISPLAY_MAP[uniqueDays[uniqueDays.length - 1]]}`;
  }

  // 3. FIX: Join ALL broken elements uniformly with an ampersand spacer
  const formattedDays = uniqueDays.map((d) => DISPLAY_MAP[d] || d);
  return formattedDays.join(" & ");
}
