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
  addLogos: (logos: Omit<Logos, 'id' | 'dateAdded' | 'nextReviewDate' | 'masteryLevel'>) => void;
  updateMastery: (id: string, success: boolean) => void;
}

export const usePebbleStore = create<PebbleStore>((set) => ({
  logoi: [
    {
      id: '1',
      text: 'Ephemeral',
      tier: 'Word',
      definition: 'Lasting for a very short time.',
      exampleSentence: 'The beauty of the sunset was ephemeral, fading into darkness within minutes.',
      sourceSentence: 'Found in: Sontag, On Photography, p. 14',
      register: 'Literary',
      masteryLevel: 3,
      nextReviewDate: new Date(),
      dateAdded: new Date('2024-01-01'),
    },
    {
      id: '2',
      text: 'Bite the bullet',
      tier: 'Phrase',
      definition: 'To endure a painful or otherwise unpleasant situation that is unavoidable.',
      exampleSentence: 'I had to bite the bullet and apologise even though I felt wronged.',
      sourceSentence: 'Heard in conversation',
      register: 'Idiomatic',
      masteryLevel: 1,
      nextReviewDate: new Date(),
      dateAdded: new Date('2024-01-05'),
    },
    {
      id: '3',
      text: 'Deeply flawed',
      tier: 'Collocation',
      definition: 'Having fundamental weaknesses or errors.',
      exampleSentence: 'The methodology of the study was deeply flawed, undermining its conclusions.',
      sourceSentence: 'The Economist, Jan 2024',
      register: 'Academic',
      masteryLevel: 4,
      nextReviewDate: addDays(new Date(), 5),
      dateAdded: new Date('2024-01-10'),
      structuralSplit: {
        part1: 'deeply',
        part2: 'flawed',
        type: 'adverb + adjective',
      },
    },
  ],
  streak: 12,
  boutOpen: false,
  setBoutOpen: (v) => set({ boutOpen: v }),
  addOpen: false,
  setAddOpen: (v) => set({ addOpen: v }),
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
