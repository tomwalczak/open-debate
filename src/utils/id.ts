export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function generateDebateId(speaker1: string, speaker2: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const s1 = speaker1.toLowerCase().replace(/\s+/g, "-").substring(0, 20);
  const s2 = speaker2.toLowerCase().replace(/\s+/g, "-").substring(0, 20);
  return `${timestamp}-${s1}-vs-${s2}`;
}
