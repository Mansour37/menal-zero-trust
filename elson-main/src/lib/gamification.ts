export const GAMIFICATION = {
  points: {
    contribution: 15, // text + audio (audio is mandatory)
    validation: 3,
    contributionValidated: 10,
    dailyStreak: 5,
    milestone10: 50,
    milestone50: 200,
    milestone100: 500,
  },
  levels: [
    { level: 1, name: "Beginner", nameAr: "مبتدئ", nameFr: "Débutant", minPoints: 0 },
    { level: 2, name: "Contributor", nameAr: "مساهم", nameFr: "Contributeur", minPoints: 100 },
    { level: 3, name: "Expert", nameAr: "خبير", nameFr: "Expert", minPoints: 500 },
    { level: 4, name: "Champion", nameAr: "بطل", nameFr: "Champion", minPoints: 2000 },
    { level: 5, name: "Legend", nameAr: "أسطورة", nameFr: "Légende", minPoints: 10000 },
  ],
  badges: [
    { id: "first_contribution", name: "First Steps", requirement: 1 },
    { id: "ten_contributions", name: "Getting Started", requirement: 10 },
    { id: "fifty_contributions", name: "Dedicated", requirement: 50 },
    { id: "hundred_contributions", name: "Centurion", requirement: 100 },
    { id: "first_recording", name: "Voice Heard", requirement: 1 },
    { id: "ten_recordings", name: "Narrator", requirement: 10 },
    { id: "first_validation", name: "Reviewer", requirement: 1 },
    { id: "streak_7", name: "Week Warrior", requirement: 7 },
  ],
} as const;

export function getLevel(points: number) {
  const levels = GAMIFICATION.levels;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].minPoints) return levels[i];
  }
  return levels[0];
}

export function getNextLevel(points: number) {
  const levels = GAMIFICATION.levels;
  for (const l of levels) {
    if (points < l.minPoints) return l;
  }
  return null;
}

export function getProgressToNextLevel(points: number) {
  const current = getLevel(points);
  const next = getNextLevel(points);
  if (!next) return 100;
  const range = next.minPoints - current.minPoints;
  const progress = points - current.minPoints;
  return Math.round((progress / range) * 100);
}
