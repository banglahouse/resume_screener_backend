export interface MatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  extraSkills: string[];
  insights: string[];
  experienceHighlight: string | null;
}
