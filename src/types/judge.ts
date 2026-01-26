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
  trajectory: string;      // How the match unfolded (momentum shifts, comebacks)
  keyArguments: string;    // Most powerful arguments that swung verdicts
  verdict: string;         // Final assessment of why the winner won
}
