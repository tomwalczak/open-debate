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
  issues: string[];  // Short titles for areas of disagreement
  summary: string;   // 3-4 sentences on what arguments made the difference
}

export interface IssueArgumentSummary {
  issue: string;
  speaker1Argument: string;  // Hierarchical propositional summary of best argument
  speaker2Argument: string;
}
