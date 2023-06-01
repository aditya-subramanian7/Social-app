import type {
  GetStaticPaths,
  GetStaticPropsContext,
  InferGetStaticPropsType,
  NextPage,
} from "next";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import { VscArrowLeft } from "react-icons/vsc";
import ProfileImage from "~/components/ProfileImage";
import { ssgHelper } from "~/server/api/ssgHelper";
import { api } from "~/utils/api";
import ErrorPage from "next/error";
import InfiniteTweetList from "~/components/InfiniteTweetList";
import { Button } from "~/components/Button";

const ProfilePage: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  id,
}) => {
  const { data: profile } = api.profile.getProfileById.useQuery({ id });
  const tweets = api.tweet.infinteFeedProfile.useInfiniteQuery(
    { userId: id },
    {
      getNextPageParam: (lastPage) => {
        lastPage.nextCursor;
      },
    }
  );
  const trpcUtils = api.useContext();
  const toggleFollow = api.profile.toggleFollow.useMutation({
    onSuccess: ({ addedFollow }) => {
      trpcUtils.profile.getProfileById.setData({ id }, (oldData) => {
        if (oldData == null) return;
        const countModifier = addedFollow ? 1 : -1;
        return {
          ...oldData,
          isFollowing: addedFollow,
          followerCount: countModifier + oldData.followerCount,
        };
      });
    },
  });
  if (!profile) {
    return <ErrorPage statusCode={404} />;
  }
  console.log(profile.isFollowing);
  return (
    <>
      <Head>
        <title>`Twitter - {profile.name}`</title>
      </Head>
      <header className="sticky top-0 z-10 flex items-center border-b bg-white px-4 py-2">
        <Link href=".." className=" mr-2">
          <VscArrowLeft className=" h-6 w-6" />
        </Link>
        <ProfileImage src={profile.image} className=" flex-shrink-0" />
        <div className="ml-2 flex-grow">
          <h1 className="text-lg font-bold">{profile.name}</h1>
          <div className=" text-gray-500">
            {profile.tweetsCount}{" "}
            {getPlural(profile.tweetsCount, "Tweet", "Tweets")}{" "}
            {profile.followerCount}{" "}
            {getPlural(profile.followerCount, "Follower", "Followers")}{" "}
            {profile.followsCount}
            {" Following"}
          </div>
        </div>
        <FollowButton
          onClick={() => {
            toggleFollow.mutate({ userId: id });
          }}
          isLoading={toggleFollow.isLoading}
          isFollowing={profile.isFollowing}
          userId={id}
        />
      </header>
      <main>
        <InfiniteTweetList
          tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
          isError={tweets.isError}
          isLoading={tweets.isLoading}
          hasMore={tweets.hasNextPage}
          fetchNewTweets={tweets.fetchNextPage}
        />
      </main>
    </>
  );
};

function FollowButton({
  onClick,
  isFollowing,
  userId,
  isLoading,
}: {
  onClick: () => any;
  isFollowing: boolean;
  userId: string;
  isLoading: boolean;
}) {
  const session = useSession();
  if (session.status != "authenticated" || session.data?.user.id === userId)
    return null;

  return (
    <Button disabled={isLoading} onClick={onClick} small gray={isFollowing}>
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}

function getPlural(number: number, singular: string, plural: string) {
  return number == 1 ? singular : plural;
}

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export async function getStaticProps(
  context: GetStaticPropsContext<{ id: string }>
) {
  const id = context.params?.id;
  if (!id) {
    return {
      redirect: {
        destination: "/",
      },
    };
  }

  const ssg = ssgHelper();
  await ssg.profile.getProfileById.prefetch({ id });

  return {
    props: {
      id,
      trpcState: ssg.dehydrate(),
    },
  };
}

export default ProfilePage;
