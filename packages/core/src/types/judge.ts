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

// Generic hierarchical argument structure (up to 3 levels deep)
export interface ArgumentPoint {
  claim: string;
  support?: Array<{
    claim: string;
    support?: Array<{
      claim: string;
    }>;
  }>;
}

export interface IssueArgumentSummary {
  issue: string;
  speaker1Argument: ArgumentPoint;
  speaker2Argument: ArgumentPoint;
}
