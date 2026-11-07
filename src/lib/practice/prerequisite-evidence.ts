/** Evidence-backed extraction: no AI inference, no implicit parent/sequence assumptions. */
export type PrerequisiteTopic = { id: string; name: string; prerequisiteIds: string[] };
export type ExplicitPrerequisite = {
  targetTopicId: string;
  requiredTopicId: string;
  explanation: string;
};

function normalize(value: string): string {
  return value
    .replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchedNames(text: string, topics: PrerequisiteTopic[]) {
  const normalized = ` ${normalize(text)} `;
  return topics.filter(t => {
    const name = normalize(t.name);
    // Do not match short or ambiguous fragments of names.
    return name.length >= 4 && normalized.includes(` ${name} `);
  });
}

/**
 * Conservatively recognizes explicit prerequisite sentences in an uploaded PDF.
 * Does not invent missing topic names or turn syllabus ordering into prerequisites.
 * Every proposal carries a verbatim quote from the PDF.
 */
export function extractExplicitPrerequisites(
  sourceText: string,
  topics: PrerequisiteTopic[],
): ExplicitPrerequisite[] {
  if (!sourceText.trim()) return [];
  const output: ExplicitPrerequisite[] = [];
  const seen = new Set<string>();
  const rawLines = sourceText.split(/\r?\n/).slice(0, 3500);
  const lines = rawLines.flatMap((line, i) => i + 1 < rawLines.length ? [line, `${line}\n${rawLines[i + 1]}`] : [line]);

  const before = /\b(?:is|are)\s+(?:a\s+)?(?:required|needed|necessary|essential|prerequisite)\s+(?:before|for)\b|\b(?:must|should)\s+be\s+(?:understood|mastered|learned)\s+before\b/i;
  const after = /\b(?:requires?|depends\s+on|builds\s+on|assumes\s+(?:prior\s+)?knowledge\s+of|requires?\s+prior\s+knowledge\s+of)\b/i;
  const beforeStudying = /\bbefore\s+(?:studying|learning|taking)\b.*\b(?:should|must|need\s+to)\b.*\b(?:understand|know|learn|master|study)\b/i;

  for (const raw of lines) {
    const quote = raw.trim();
    if (quote.length < 20 || quote.length > 450) continue;
    const candidates = matchedNames(quote, topics);
    if (candidates.length < 2 || candidates.length > 5) continue;
    const line = normalize(quote);
    for (const target of candidates) for (const required of candidates) {
      if (target.id === required.id) continue;
      if (target.prerequisiteIds.includes(required.id)) continue;
      const tn = normalize(target.name);
      const rn = normalize(required.name);
      const tp = line.indexOf(tn);
      const rp = line.indexOf(rn);
      if (tp === -1 || rp === -1 || tp === rp || tn.includes(rn) || rn.includes(tn)) continue;
      let explicitlyRequired = false;
      if (rp < tp) {
        // "Knowledge of BFS is required before A Star Search".
        explicitlyRequired = before.test(line.slice(rp + rn.length, tp));
      } else {
        // "A Star Search requires BFS" or
        // "Before studying A Star Search, students should understand BFS".
        const between = line.slice(tp + tn.length, rp);
        explicitlyRequired = !/\b(?:not|never|without|may|might|could|sometimes)\b/.test(between) && (after.test(between) ||
          (line.slice(0, tp).includes('before studying') && beforeStudying.test(line))); 
      }
      if (!explicitlyRequired) continue;
      const key = `${target.id}:${required.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({ targetTopicId: target.id, requiredTopicId: required.id,
        explanation: `Verbatim source PDF: "${quote}"` });
      if (output.length >= 30) return output;
    }
  }
  return output;
}
