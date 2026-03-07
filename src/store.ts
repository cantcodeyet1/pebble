import { create } from 'zustand';
import { addDays } from 'date-fns';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates)].sort().reverse();
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86_400_000));
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 0;
  let expected = unique[0];
  for (const date of unique) {
    if (date === expected) {
      streak++;
      const d = new Date(expected + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expected = toDateStr(d);
    } else {
      break;
    }
  }
  return streak;
}

export type Tier = 'Word' | 'Phrase';
export type Register = 'Formal' | 'Informal' | 'Literary' | 'Academic' | 'Idiomatic';

export interface Logos {
  id: string;
  text: string;
  tier: Tier;
  definition: string;
  exampleSentence: string;
  sourceSentence?: string;
  register: Register;
  phonetic?: string;
  pos?: string;
  synonyms?: string[];
  masteryLevel: number; // 0 to 5
  nextReviewDate: Date;
  dateAdded: Date;
  starred?: boolean;
  structuralSplit?: {
    part1: string;
    part2: string;
    type: string;
  };
}

interface PebbleStore {
  logoi: Logos[];
  streak: number;
  activityDates: string[];
  boutOpen: boolean;
  setBoutOpen: (v: boolean) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  setLogoi: (logoi: Logos[]) => void;
  setActivityDates: (dates: string[]) => void;
  recordActivity: () => void;
  addLogos: (logos: Omit<Logos, 'id' | 'dateAdded' | 'nextReviewDate' | 'masteryLevel'>) => void;
  appendLogos: (logos: Logos) => void;
  updateMastery: (id: string, success: boolean) => void;
}

export const usePebbleStore = create<PebbleStore>((set) => ({
  logoi: [],
  streak: 0,
  activityDates: [],
  boutOpen: false,
  setBoutOpen: (v) => set({ boutOpen: v }),
  addOpen: false,
  setAddOpen: (v) => set({ addOpen: v }),
  setLogoi: (logoi) => set({ logoi }),
  setActivityDates: (dates) => set({ activityDates: dates, streak: computeStreak(dates) }),
  recordActivity: () => set((state) => {
    const today = toDateStr(new Date());
    if (state.activityDates.includes(today)) return state;
    const newDates = [...state.activityDates, today];
    return { activityDates: newDates, streak: computeStreak(newDates) };
  }),
  appendLogos: (logos) => set((state) => {
    const today = toDateStr(new Date());
    const newDates = state.activityDates.includes(today)
      ? state.activityDates
      : [...state.activityDates, today];
    return { logoi: [logos, ...state.logoi], activityDates: newDates, streak: computeStreak(newDates) };
  }),
  addLogos: (newLogos) => set((state) => ({
    logoi: [
      ...state.logoi,
      {
        ...newLogos,
        id: Math.random().toString(36).substring(7),
        dateAdded: new Date(),
        nextReviewDate: addDays(new Date(), 1),
        masteryLevel: 0,
      },
    ],
  })),
  updateMastery: (id, success) => set((state) => ({
    logoi: state.logoi.map((l) => {
      if (l.id === id) {
        const newLevel = success ? Math.min(l.masteryLevel + 1, 5) : Math.max(l.masteryLevel - 1, 0);
        return {
          ...l,
          masteryLevel: newLevel,
          nextReviewDate: addDays(new Date(), Math.pow(2, newLevel)),
        };
      }
      return l;
    }),
  })),
}));
