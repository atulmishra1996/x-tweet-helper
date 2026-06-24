import { PageHeader } from "@/components/page-header";
import { TweetStudio } from "@/components/tweet/tweet-studio";

export default async function TweetPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const { idea } = await searchParams;
  return (
    <>
      <PageHeader title="Tweet Studio" description="Draft tweets and threads, reply to posts with AI, then post or schedule." />
      <TweetStudio initialIdea={idea ?? ""} />
    </>
  );
}
