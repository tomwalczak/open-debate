export interface JudgeVerdict {
  winnerId: string;
  winnerName: string;
  reason: string;
}

export interface FinalTally {
  speaker1Wins: number;
  speaker2Wins: number;
  ties: number;
}
