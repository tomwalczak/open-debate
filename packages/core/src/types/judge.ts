export interface JudgeVerdict {
  reasoning: string;
  winnerId: string;
}

export interface FinalTally {
  speaker1Wins: number;
  speaker2Wins: number;
  ties: number;
}

export interface MatchSummary {
  summary: string;  // Cohesive analysis covering trajectory, key arguments, and verdict
}
