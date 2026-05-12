import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CookingDay {
  date: string;       // YYYY-MM-DD
  dayName: string;    // e.g. "Monday"
  morningTeam: string;
  nightTeam: string;
  morningDone?: boolean;
  nightDone?: boolean;
}

export interface CookingSchedule {
  id: string;         // monthKey e.g. "2026-04"
  month: string;      // "2026-04"
  days: CookingDay[];
  uploadedAt?: any;
}

/** Normalize a date string (any common format) to YYYY-MM-DD.
 *  Handles: "Apr 1", "Apr 1, 2026", "Apr 1 2026", "2026-04-01", "01/04/2026" etc.
 *  When no year is in the string, uses the current year.
 */
function normalizeDateToISO(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try parsing via JS Date (works for "Apr 1", "April 1, 2026", etc.)
  const currentYear = new Date().getFullYear();

  // Append year if not present so JS can parse it
  const withYear = /\d{4}/.test(s) ? s : `${s} ${currentYear}`;
  const d = new Date(withYear);

  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // DD/MM/YYYY fallback
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  return s; // Return as-is if we can't parse
}

/** Parse a CSV string into an array of CookingDay objects.
 *  Supported headers (case-insensitive, spaces ok):
 *    date, day / day name, morning team / morning_team, night team / night_team
 *
 *  Date cell formats accepted: "Apr 1", "Apr 1 2026", "April 1, 2026",
 *  "2026-04-01", "01/04/2026" — any JS-parseable date string.
 */
export function parseCookingCSV(csvText: string): CookingDay[] {
  // Remove BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s]+/g, '_'));

  const colIdx = (keys: string[]) => {
    for (const k of keys) {
      const i = header.indexOf(k);
      if (i !== -1) return i;
    }
    return -1;
  };

  const dateIdx    = colIdx(['date']);
  const dayIdx     = colIdx(['day', 'day_name']);
  const morningIdx = colIdx(['morning_team', 'morning', 'morning_team_(cooking_duty)', 'morning team']);
  const nightIdx   = colIdx(['night_team',   'night',   'night_team_(cooking_duty)',   'night team']);

  if (dateIdx === -1 || morningIdx === -1 || nightIdx === -1) {
    throw new Error(
      `CSV must have columns: date, morning_team, night_team (and optionally day).\n` +
      `Detected columns: ${header.join(', ')}`
    );
  }

  return lines.slice(1)
    .map(line => {
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cols.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      cols.push(current.trim().replace(/^"|"$/g, ''));

      const rawDate = cols[dateIdx] || '';
      if (!rawDate) return null;

      const isoDate = normalizeDateToISO(rawDate);
      if (!isoDate) return null;

      // Day name: prefer from CSV, otherwise compute from normalized iso date
      let dayName = dayIdx !== -1 ? cols[dayIdx]?.trim() || '' : '';
      if (!dayName && isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Parse as local date by appending T00:00:00 to avoid UTC shift
        dayName = new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      }

      return {
        date: isoDate,
        dayName,
        morningTeam: cols[morningIdx] || '',
        nightTeam:   cols[nightIdx]   || '',
        morningDone: false,
        nightDone:   false,
      } as CookingDay;
    })
    .filter(Boolean) as CookingDay[];
}

export function useCookingSchedule() {
  const [schedules, setSchedules] = useState<CookingSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'cookingSchedules'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<CookingSchedule, 'id'>),
      }));
      // sort by month desc
      data.sort((a, b) => b.month.localeCompare(a.month));
      setSchedules(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  /** Upload/replace schedule for a given month */
  const uploadSchedule = async (month: string, days: CookingDay[]) => {
    const ref = doc(db, 'cookingSchedules', month);
    await setDoc(ref, {
      month,
      days,
      uploadedAt: serverTimestamp(),
    });
  };

  /** Toggle morning or night attendance for a specific date within a month */
  const toggleAttendance = async (
    month: string,
    date: string,
    slot: 'morningDone' | 'nightDone',
    value: boolean
  ) => {
    const schedule = schedules.find(s => s.month === month);
    if (!schedule) return;

    const updatedDays = schedule.days.map(d =>
      d.date === date ? { ...d, [slot]: value } : d
    );

    const ref = doc(db, 'cookingSchedules', month);
    await updateDoc(ref, { days: updatedDays });
  };

  /** Delete a month's schedule */
  const deleteSchedule = async (month: string) => {
    await deleteDoc(doc(db, 'cookingSchedules', month));
  };

  /** Get schedule for the current month */
  const getCurrentMonthSchedule = (): CookingSchedule | undefined => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return schedules.find(s => s.month === currentMonth);
  };

  /** Get today's entry from the current month's schedule */
  const getTodayEntry = (): CookingDay | undefined => {
    const schedule = getCurrentMonthSchedule();
    if (!schedule) return undefined;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return schedule.days.find(d => d.date === today);
  };

  /** Compute streak: consecutive days where a team cooked (both morning + night ticked) */
  const getTeamStreak = (teamName: string): number => {
    const schedule = getCurrentMonthSchedule();
    if (!schedule) return 0;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Days up to and including today, sorted descending
    const pastDays = schedule.days
      .filter(d => d.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));

    let streak = 0;
    for (const day of pastDays) {
      const teamMorning = day.morningTeam === teamName;
      const teamNight = day.nightTeam === teamName;

      // Only count days this team had a duty
      if (!teamMorning && !teamNight) {
        // Team had no duty this day; don't break streak, just skip
        continue;
      }

      const morningOk = !teamMorning || day.morningDone;
      const nightOk = !teamNight || day.nightDone;

      if (morningOk && nightOk) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  return {
    schedules,
    loading,
    uploadSchedule,
    toggleAttendance,
    deleteSchedule,
    getCurrentMonthSchedule,
    getTodayEntry,
    getTeamStreak,
  };
}
