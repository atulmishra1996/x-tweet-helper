import { describe, it, expect } from "vitest";
import { parseNumberedList, parseThread, tweetVariants, blogOutline } from "@/lib/prompts";

describe("prompt parsing", () => {
  it("parses a numbered list", () => {
    const text = "1. First tweet\n2. Second tweet\n3) Third tweet";
    expect(parseNumberedList(text)).toEqual(["First tweet", "Second tweet", "Third tweet"]);
  });

  it("ignores blank lines in a numbered list", () => {
    expect(parseNumberedList("\n1. A\n\n2. B\n")).toEqual(["A", "B"]);
  });

  it("parses a thread split by ---", () => {
    const text = "Tweet one\n---\nTweet two\n---\nTweet three";
    expect(parseThread(text)).toEqual(["Tweet one", "Tweet two", "Tweet three"]);
  });
});

describe("prompt builders", () => {
  it("includes the voice in the system prompt when provided", () => {
    const p = tweetVariants({ idea: "ship fast", voice: "be concise" });
    expect(p.system).toContain("be concise");
    expect(p.prompt).toContain("ship fast");
  });

  it("blogOutline includes title and audience", () => {
    const p = blogOutline({ title: "Caching 101", audience: "juniors" });
    expect(p.prompt).toContain("Caching 101");
    expect(p.prompt).toContain("juniors");
  });
});
