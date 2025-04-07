import type { InferSelectModel } from 'drizzle-orm';
import type { lgtKudosReactions } from '../db/schema';

export type KudosReaction = InferSelectModel<typeof lgtKudosReactions>;

export interface KudosLevel {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

export const KUDOS_LEVELS: KudosLevel[] = [
  { level: 1, name: 'Newcomer', minPoints: 0, maxPoints: 50 },
  { level: 2, name: 'Helper', minPoints: 51, maxPoints: 150 },
  { level: 3, name: 'Supporter', minPoints: 151, maxPoints: 300 },
  { level: 4, name: 'Guide', minPoints: 301, maxPoints: 500 },
  { level: 5, name: 'Mentor', minPoints: 501, maxPoints: 800 },
  { level: 6, name: 'Expert', minPoints: 801, maxPoints: 1200 },
  { level: 7, name: 'Guru', minPoints: 1201, maxPoints: 1700 },
  { level: 8, name: 'Sage', minPoints: 1701, maxPoints: 2300 },
  { level: 9, name: 'Legend', minPoints: 2301, maxPoints: 3000 },
  { level: 10, name: 'Champion', minPoints: 3001, maxPoints: null },
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
