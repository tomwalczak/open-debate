export interface JudgeVerdict {
  reasoning: string;
  winnerId: string;
}

export interface FinalTally {
  speaker1Wins: number;
  speaker2Wins: number;
  ties: number;
}
