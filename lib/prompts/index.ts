/**
 * Prompt library. Kept out of components/routes so prompts can evolve and be
 * tested independently. Each builder returns { system, prompt }.
 */

export interface Prompt {
  system: string;
  prompt: string;
}

const BASE_VOICE = `You are an expert X (Twitter) growth ghostwriter who helps a creator
build engagement, followers and subscribers. Write in a clear, confident, human voice.
Avoid hashtag spam (0-2 max, only if they add reach), avoid emojis unless they genuinely help,
never sound like a press release, and prefer concrete specifics over vague claims.`;

function withVoice(voice?: string): string {
  const v = voice?.trim();
  return v ? `${BASE_VOICE}\n\nThe creator's personal voice/notes:\n"""${v}"""` : BASE_VOICE;
}

export type Tone = "casual" | "sharp" | "teaching" | "story" | "professional";

const TONE_HINT: Record<Tone, string> = {
  casual: "Tone: casual and conversational, like talking to a smart friend.",
  sharp: "Tone: sharp, punchy, opinionated. Strong hooks, no filler.",
  teaching: "Tone: teaching. Make one idea click with a concrete example.",
  story: "Tone: short personal story or anecdote that lands a point.",
  professional: "Tone: professional and credible, still human.",
};

export function tweetVariants(input: {
  idea: string;
  tone?: Tone;
  voice?: string;
  count?: number;
}): Prompt {
  const count = input.count ?? 3;
  return {
    system: withVoice(input.voice),
    prompt: `Write ${count} distinct single-tweet options (each under 280 characters) based on this idea:

"""${input.idea}"""

${input.tone ? TONE_HINT[input.tone] : TONE_HINT.sharp}

Each option should use a different angle or hook. Return ONLY the tweets, one per line,
numbered like "1." "2." "3." with no commentary.`,
  };
}

export type TweetAction = "shorten" | "punch_up" | "add_cta" | "hashtags" | "fix_grammar";

const ACTION_INSTRUCTION: Record<TweetAction, string> = {
  shorten: "Rewrite it shorter and tighter while keeping the core point. Stay under 280 characters.",
  punch_up: "Rewrite it with a stronger hook and more energy. Stay under 280 characters.",
  add_cta: "Add a natural call-to-action (reply, follow, or subscribe) without being needy. Stay under 280 characters.",
  hashtags: "Suggest 1-2 high-signal hashtags that would genuinely extend reach, appended at the end. Stay under 280 characters.",
  fix_grammar: "Fix grammar and clarity only. Do not change the voice or meaning.",
};

export function tweetAction(input: { text: string; action: TweetAction; voice?: string }): Prompt {
  return {
    system: withVoice(input.voice),
    prompt: `Here is a tweet:

"""${input.text}"""

${ACTION_INSTRUCTION[input.action]}

Return ONLY the revised tweet, no commentary.`,
  };
}

export function threadFromOutline(input: { idea: string; voice?: string; length?: number }): Prompt {
  const length = input.length ?? 5;
  return {
    system: withVoice(input.voice),
    prompt: `Turn this idea into an X thread of about ${length} tweets:

"""${input.idea}"""

Rules:
- Tweet 1 is a strong hook that earns the click.
- Each tweet under 280 characters and able to stand alone.
- Last tweet includes a soft call-to-action (follow/subscribe for more).
Return each tweet on its own block, separated by a line containing only "---".
No numbering, no commentary.`,
  };
}

export function blogOutline(input: {
  title: string;
  topic?: string;
  audience?: string;
  goal?: string;
  voice?: string;
}): Prompt {
  return {
    system: withVoice(input.voice),
    prompt: `Create a blog post outline.

Title/topic: ${input.title}${input.topic ? ` (${input.topic})` : ""}
Audience: ${input.audience ?? "general tech-savvy readers"}
Goal: ${input.goal ?? "teach"}

Return 4-7 H2 section headings as a numbered list ("1." "2." ...). For each, add a short
parenthetical note on what it covers. No intro/outro text, just the list.`,
  };
}

export function blogSection(input: {
  title: string;
  heading: string;
  notes?: string;
  existing?: string;
  action: "expand" | "tighten" | "example";
  voice?: string;
}): Prompt {
  const action =
    input.action === "expand"
      ? "Write this section in full (2-4 short paragraphs), in Markdown."
      : input.action === "tighten"
        ? "Tighten and clarify the existing section text below without losing substance."
        : "Add a concrete example or mini case study to the section.";
  return {
    system: withVoice(input.voice),
    prompt: `Blog: "${input.title}"
Section heading: "${input.heading}"
${input.notes ? `Section notes: ${input.notes}` : ""}
${input.existing ? `Existing text:\n"""${input.existing}"""` : ""}

${action}
Return ONLY the Markdown for this section's body (no heading line, no commentary).`,
  };
}

export function blogPolish(input: { title: string; contentMd: string; voice?: string }): Prompt {
  return {
    system: withVoice(input.voice),
    prompt: `Polish this blog draft for clarity, flow, and a strong intro and conclusion.
Keep the author's voice. Keep it in Markdown. Do not pad length.

Title: ${input.title}

"""${input.contentMd}"""

Return ONLY the polished Markdown.`,
  };
}

export function tweetsFromBlog(input: { title: string; contentMd: string; voice?: string; count?: number }): Prompt {
  const count = input.count ?? 5;
  return {
    system: withVoice(input.voice),
    prompt: `From this blog, extract ${count} standalone tweet angles that would drive readers to it.

Title: ${input.title}

"""${input.contentMd.slice(0, 4000)}"""

Each tweet under 280 characters, different angle each. Return one per line, numbered.`,
  };
}

export function remixWinner(input: { text: string; voice?: string; count?: number }): Prompt {
  const count = input.count ?? 3;
  return {
    system: withVoice(input.voice),
    prompt: `This tweet performed well:

"""${input.text}"""

Write ${count} fresh variations that reuse what made it work (hook style, structure, angle)
but with new wording so it doesn't feel repetitive. Each under 280 characters.
Return one per line, numbered.`,
  };
}

/** Parse a numbered "1. ... 2. ..." list into trimmed items. */
export function parseNumberedList(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/** Parse a thread separated by lines containing only "---". */
export function parseThread(text: string): string[] {
  return text
    .split(/\n\s*---\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseOutlineList(text: string): { heading: string; notes?: string }[] {
  const items: { heading: string; notes?: string }[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const cleaned = line.replace(/^\s*(?:\d+[.)]|[-*•]|#{1,3})\s+/, "").trim();
    if (!cleaned) continue;
    const paren = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
      items.push({ heading: paren[1].trim(), notes: paren[2].trim() });
      continue;
    }
    items.push({ heading: cleaned });
  }
  return items;
}

/** Extract markdown body for a ## heading from a draft. */
export function extractSectionBody(contentMd: string, heading: string): string | undefined {
  if (!contentMd.trim() || !heading.trim()) return undefined;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|\\Z)`, "im");
  const match = contentMd.match(re);
  return match?.[1]?.trim() || undefined;
}

export function tweetReply(input: {
  tweetText: string;
  authorHandle: string;
  guidance?: string;
  tone?: Tone;
  voice?: string;
  count?: number;
}): Prompt {
  const count = input.count ?? 3;
  return {
    system: withVoice(input.voice),
    prompt: `Write ${count} reply options to this tweet by @${input.authorHandle}:

"""${input.tweetText}"""

${input.tone ? TONE_HINT[input.tone] : TONE_HINT.sharp}
${input.guidance?.trim() ? `Additional guidance from the author:\n"""${input.guidance.trim()}"""\n` : ""}
Rules:
- Each reply under 280 characters.
- Add genuine value: insight, question, or respectful disagreement — not "great post".
- Do not start with @${input.authorHandle} (X adds the mention automatically on reply).
Return ONLY the replies, one per line, numbered like "1." "2." "3." with no commentary.`,
  };
}
