import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getOrCreateSettings } from "@/lib/settings";
import { generate } from "@/lib/llm/factory";
import {
  blogOutline,
  blogSection,
  blogPolish,
  tweetsFromBlog,
  parseNumberedList,
  parseOutlineList,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  mode: z.enum(["outline", "section", "polish", "tweets"]),
  title: z.string().default("Untitled"),
  topic: z.string().optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
  heading: z.string().optional(),
  notes: z.string().optional(),
  existing: z.string().optional(),
  sectionAction: z.enum(["expand", "tighten", "example"]).optional(),
  contentMd: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  const { voicePrompt } = await getOrCreateSettings(user.id);
  const voice = voicePrompt ?? undefined;

  let prompt;
  switch (body.mode) {
    case "outline":
      prompt = blogOutline({ title: body.title, topic: body.topic, audience: body.audience, goal: body.goal, voice });
      break;
    case "section":
      prompt = blogSection({
        title: body.title,
        heading: body.heading ?? "",
        notes: body.notes,
        existing: body.existing,
        action: body.sectionAction ?? "expand",
        voice,
      });
      break;
    case "polish":
      prompt = blogPolish({ title: body.title, contentMd: body.contentMd ?? "", voice });
      break;
    case "tweets":
      prompt = tweetsFromBlog({ title: body.title, contentMd: body.contentMd ?? "", voice, count: body.count });
      break;
  }

  const result = await generate({
    userId: user.id,
    feature: "blog",
    system: prompt.system,
    prompt: prompt.prompt,
    maxOutputTokens: 2000,
  });

  let output: Record<string, unknown>;
  if (body.mode === "outline") {
    output = { outline: parseOutlineList(result.text) };
  } else if (body.mode === "tweets") {
    output = { variants: parseNumberedList(result.text) };
  } else {
    output = { text: result.text };
  }

  return ok({ ...output, provider: result.provider, model: result.model });
});
