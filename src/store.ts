import { create } from 'zustand';
import { addDays } from 'date-fns';

export type Tier = 'Word' | 'Phrase' | 'Collocation';
export type Register = 'Formal' | 'Informal' | 'Literary' | 'Academic' | 'Idiomatic';

export interface Logos {
  id: string;
  text: string;
  tier: Tier;
  definition: string;
  exampleSentence: string;
  sourceSentence?: string;
  register: Register;
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
  boutOpen: boolean;
  setBoutOpen: (v: boolean) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  setLogoi: (logoi: Logos[]) => void;
  addLogos: (logos: Omit<Logos, 'id' | 'dateAdded' | 'nextReviewDate' | 'masteryLevel'>) => void;
  appendLogos: (logos: Logos) => void;
  updateMastery: (id: string, success: boolean) => void;
}

export const usePebbleStore = create<PebbleStore>((set) => ({
  logoi: [],
  streak: 12,
  boutOpen: false,
  setBoutOpen: (v) => set({ boutOpen: v }),
  addOpen: false,
  setAddOpen: (v) => set({ addOpen: v }),
  setLogoi: (logoi) => set({ logoi }),
  appendLogos: (logos) => set((state) => ({ logoi: [logos, ...state.logoi] })),
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
