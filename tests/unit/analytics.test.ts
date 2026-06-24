import { describe, it, expect } from "vitest";
import { engagementRate, type MetricTotals } from "@/lib/analytics";
import { formatNumber, formatDelta, pct } from "@/lib/utils";

const base: MetricTotals = {
  impressions: 1000,
  likes: 50,
  retweets: 20,
  replies: 20,
  quotes: 10,
  bookmarks: 5,
  profileClicks: 0,
  urlClicks: 0,
  engagements: 0,
};

describe("engagementRate", () => {
  it("computes interactions / impressions as a percentage", () => {
    // (50+20+20+10) / 1000 = 10%
    expect(engagementRate(base)).toBeCloseTo(10);
  });

  it("returns 0 with no impressions", () => {
    expect(engagementRate({ ...base, impressions: 0 })).toBe(0);
  });
});

describe("formatters", () => {
  it("formats large numbers", () => {
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(2_000_000)).toBe("2.0M");
    expect(formatNumber(42)).toBe("42");
  });

  it("formats deltas with sign", () => {
    expect(formatDelta(5)).toBe("+5");
    expect(formatDelta(-3)).toBe("-3");
    expect(formatDelta(0)).toBe("0");
  });

  it("computes percentage safely", () => {
    expect(pct(25, 100)).toBe(25);
    expect(pct(1, 0)).toBe(0);
  });
});
