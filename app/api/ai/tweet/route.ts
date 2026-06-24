import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateSettings } from "@/lib/settings";
import { generate } from "@/lib/llm/factory";
import {
  tweetVariants,
  tweetAction,
  threadFromOutline,
  remixWinner,
  tweetReply,
  parseNumberedList,
  parseThread,
  type Tone,
  type TweetAction,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  mode: z.enum(["variants", "action", "thread", "remix", "reply"]),
  idea: z.string().optional(),
  text: z.string().optional(),
  action: z.enum(["shorten", "punch_up", "add_cta", "hashtags", "fix_grammar"]).optional(),
  tone: z.enum(["casual", "sharp", "teaching", "story", "professional"]).optional(),
  length: z.number().int().min(2).max(15).optional(),
  count: z.number().int().min(1).max(6).optional(),
  tweetText: z.string().optional(),
  authorHandle: z.string().optional(),
  guidance: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  const { voicePrompt } = await getOrCreateSettings(user.id);
  const voice = voicePrompt ?? undefined;

  let prompt;
  switch (body.mode) {
    case "variants":
      prompt = tweetVariants({ idea: body.idea ?? "", tone: body.tone as Tone, voice, count: body.count });
      break;
    case "action":
      prompt = tweetAction({ text: body.text ?? "", action: body.action as TweetAction, voice });
      break;
    case "thread":
      prompt = threadFromOutline({ idea: body.idea ?? "", voice, length: body.length });
      break;
    case "remix":
      prompt = remixWinner({ text: body.text ?? "", voice, count: body.count });
      break;
    case "reply":
      prompt = tweetReply({
        tweetText: body.tweetText ?? "",
        authorHandle: body.authorHandle ?? "user",
        guidance: body.guidance,
        tone: body.tone as Tone,
        voice,
        count: body.count,
      });
      break;
  }

  const result = await generate({
    userId: user.id,
    feature: "tweet",
    system: prompt.system,
    prompt: prompt.prompt,
  });

  const output =
    body.mode === "thread"
      ? { thread: parseThread(result.text) }
      : body.mode === "action"
        ? { text: result.text }
        : body.mode === "reply"
          ? { variants: parseNumberedList(result.text) }
          : { variants: parseNumberedList(result.text) };

  return ok({ ...output, provider: result.provider, model: result.model });
});
