import InfiniteScroll from "react-infinite-scroll-component";
import ProfileImage from "./ProfileImage";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  VscEllipsis,
  VscHeart,
  VscHeartFilled,
  VscThreeBars,
} from "react-icons/vsc";
import { api } from "~/utils/api";
import { useState } from "react";

type Tweet = {
  id: string;
  content: string;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  user: { id: string; image: string | null; name: string | null };
};

type InfiniteTweetListProps = {
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  fetchNewTweets: () => Promise<unknown>;
  tweets: Tweet[];
};

type HeartButtonProps = {
  likedByMe: boolean;
  likeCount: number;
  isLoading: boolean;
  onClick: () => void;
};

export default function InfiniteTweetList({
  tweets,
  isError,
  isLoading,
  fetchNewTweets,
  hasMore = false,
}: InfiniteTweetListProps) {
  if (isLoading) return <h1>Loading</h1>;
  if (isError) return <h1>Error</h1>;

  if (!tweets || tweets.length == 0) {
    return (
      <h2 className=" my-4 text-center text-2xl text-gray-500">No tweets</h2>
    );
  }

  return (
    <ul>
      <InfiniteScroll
        dataLength={tweets.length}
        next={fetchNewTweets}
        hasMore={hasMore}
        loader={"Loading..."}
      >
        {tweets.map((tweet) => {
          return <TweetCard key={tweet.id} {...tweet} />;
        })}
      </InfiniteScroll>
    </ul>
  );
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
});

function TweetCard({
  id,
  user,
  content,
  createdAt,
  likedByMe,
  likeCount,
}: Tweet) {
  const trpcUtils = api.useContext();
  const [openDropdown, setOpenDropdown] = useState<boolean>(false);
  const deleteTweet = api.tweet.deleteTweet.useMutation({
    onSuccess: (res) => {
      trpcUtils.invalidate();
    },
  });
  const toggleLike = api.tweet.toggleLike.useMutation({
    onSuccess: async ({ addedLike }) => {
      const updateData: Parameters<
        typeof trpcUtils.tweet.infiniteFeed.setInfiniteData
      >[1] = (oldData) => {
        if (!oldData) return;

        const countModifier = addedLike ? 1 : -1;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => {
            return {
              ...page,
              tweets: page.tweets.map((tweet) => {
                if (tweet.id == id) {
                  console.log(addedLike);
                  return {
                    ...tweet,
                    likeCount: tweet.likeCount + countModifier,
                    likedByMe: addedLike,
                  };
                }

                return tweet;
              }),
            };
          }),
        };
      };

      await trpcUtils.tweet.infiniteFeed.setInfiniteData({}, updateData);
      await trpcUtils.tweet.infiniteFeed.setInfiniteData(
        { onlyFollowing: true },
        updateData
      );
      await trpcUtils.tweet.infinteFeedProfile.setInfiniteData(
        { userId: user.id },
        updateData
      );
    },
  });

  function handleToggleLike() {
    toggleLike.mutate({ id });
  }

  function handleDeleteTweet() {
    deleteTweet.mutate({ tweetId: id });
  }

  return (
    <li className="flex border-b px-4 py-4">
      <Link href={`profiles/${user.id}`}>
        <ProfileImage src={user.image} />
      </Link>
      <div className="flex flex-grow flex-col">
        <div className="flex gap-1">
          <Link
            href={`profiles/${user.id}`}
            className=" ml-3 font-bold outline-none hover:underline focus-visible:underline"
          >
            {user.name}
          </Link>
          <span className=" text-gray-500">-</span>
          <span className=" text-gray-500">
            {dateTimeFormatter.format(createdAt)}
          </span>
        </div>
        <p className=" ml-3 whitespace-pre-wrap">{content}</p>
        <div className="ml-3">
          <HeartButton
            likeCount={likeCount}
            likedByMe={likedByMe}
            onClick={handleToggleLike}
            isLoading={toggleLike.isLoading}
          />
        </div>
      </div>
      <div>
        <button
          className=" rounded-2xl hover:bg-gray-300"
          onClick={() => {
            openDropdown ? setOpenDropdown(false) : setOpenDropdown(true);
          }}
        >
          <VscEllipsis />
        </button>
        {openDropdown && (
          <div className="">
            <ul>
              <li>
                <button
                  onClick={handleDeleteTweet}
                  className=" hover:bg-gray-300"
                >
                  Delete Tweet
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function HeartButton({
  likedByMe,
  likeCount,
  isLoading,
  onClick,
}: HeartButtonProps) {
  const session = useSession();
  const HeartIcon = likedByMe ? VscHeartFilled : VscHeart;

  if (session.status != "authenticated")
    return (
      <div className="mb-1 mt-1 flex items-center gap-3 self-start text-gray-500">
        <HeartIcon />
        <span>{likeCount}</span>
      </div>
    );

  return (
    <button
      disabled={isLoading}
      onClick={onClick}
      className={`group flex items-center gap-1 self-start transition-colors duration-200 ${
        likedByMe
          ? "text-red-500"
          : "text-gray-500 hover:text-red-500 focus-visible:text-red-500"
      }`}
    >
      <HeartIcon
        className={` transition-colors duration-200 ${
          likedByMe
            ? "fill-red-500"
            : "fill-gray-500 group-hover:fill-red-500 group-focus-visible:fill-red-500"
        }`}
      />
      <span>{likeCount}</span>
    </button>
  );
}
