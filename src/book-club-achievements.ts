export type BanAchievement = {
  threshold: number;
  title: string;
  subtitle: string;
};

export const BAN_ACHIEVEMENTS: BanAchievement[] = [
  {
    threshold: 10,
    title: 'The Grasshopper',
    subtitle:
      'Still mastering the ancient art of getting ejected from LGT Book Club',
  },
  {
    threshold: 20,
    title: 'The Enthusiast',
    subtitle: 'Collects bans like others collect server emotes',
  },
  {
    threshold: 30,
    title: 'The Connoisseur',
    subtitle: 'Has sampled every possible reason for being banned',
  },
  {
    threshold: 40,
    title: 'The Inevitable',
    subtitle: 'Like death and taxes, their bans are a certainty',
  },
  {
    threshold: 50,
    title: 'The Legend',
    subtitle: 'Their ban history is now required reading for new members',
  },
  {
    threshold: 69,
    title: 'Nice',
    subtitle: 'Nice',
  },
  {
    threshold: 100,
    title: 'The Immortal',
    subtitle:
      'Somehow still part of the server despite breaking every rule in existence',
  },
  {
    threshold: 250,
    title: "You're Noel",
    subtitle: 'At this point, just change your name',
  },
];

export function highestAchievement(banCount: number): BanAchievement | null {
  let earned: BanAchievement | null = null;
  for (const achievement of BAN_ACHIEVEMENTS) {
    if (banCount >= achievement.threshold) earned = achievement;
  }
  return earned;
}
