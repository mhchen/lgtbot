import type { InferSelectModel } from 'drizzle-orm';
import type { kudosReactions } from '../db/schema';

export type KudosReaction = InferSelectModel<typeof kudosReactions>;

export interface KudosLevel {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

export const KUDOS_LEVELS: KudosLevel[] = [
  { level: 1, name: 'Newcomer', minPoints: 0, maxPoints: 49 },
  { level: 2, name: 'Helper', minPoints: 50, maxPoints: 149 },
  { level: 3, name: 'Supporter', minPoints: 150, maxPoints: 299 },
  { level: 4, name: 'Guide', minPoints: 300, maxPoints: 499 },
  { level: 5, name: 'Mentor', minPoints: 500, maxPoints: 799 },
  { level: 6, name: 'Expert', minPoints: 800, maxPoints: 1199 },
  { level: 7, name: 'Guru', minPoints: 1200, maxPoints: 1699 },
  { level: 8, name: 'Sage', minPoints: 1700, maxPoints: 2299 },
  { level: 9, name: 'Legend', minPoints: 2300, maxPoints: 2999 },
  { level: 10, name: 'Champion', minPoints: 3000, maxPoints: null },
];

export const POINTS = {
  FIRST_REACTION: 10,
  ADDITIONAL_REACTION: 3,
  GIVING_REACTION: 1,
} as const;

// export const KUDOS_CONFIG = {
//   DAILY_REACTION_LIMIT: 25,
// } as const;

export interface UserKudosStats {
  userId: string;
  totalPoints: number;
  level: KudosLevel;
  reactionsReceived: number;
  reactionsGiven: number;
  pointsToNextLevel: number | null;
}
