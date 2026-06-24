import { describe, expect, it } from "vitest";
import { parseTweetIdFromUrl, tweetPermalink, parseHandleFromTweetUrl } from "@/lib/x/tweet-url";
import { parseOutlineList, extractSectionBody } from "@/lib/prompts";

describe("tweet-url", () => {
  it("parses x.com status URLs", () => {
    expect(parseTweetIdFromUrl("https://x.com/atulmishra1996/status/1234567890")).toBe("1234567890");
    expect(parseHandleFromTweetUrl("https://x.com/sidhant/status/1234567890")).toBe("sidhant");
  });

  it("parses raw ids", () => {
    expect(parseTweetIdFromUrl("1234567890")).toBe("1234567890");
  });

  it("builds permalinks", () => {
    expect(tweetPermalink("user", "99")).toBe("https://x.com/user/status/99");
  });
});

describe("blog prompt helpers", () => {
  it("parses numbered and markdown outlines", () => {
    const items = parseOutlineList(`1. Intro (hook readers)
## Core idea
- Example section (with a case study)`);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ heading: "Intro", notes: "hook readers" });
    expect(items[1].heading).toBe("Core idea");
  });

  it("extracts section bodies from markdown", () => {
    const md = "## Intro\n\nHello world.\n\n## Next\n\nMore text.";
    expect(extractSectionBody(md, "Intro")).toBe("Hello world.");
    expect(extractSectionBody(md, "Missing")).toBeUndefined();
  });
});
