import { Prisma } from "@prisma/client";
import { inferAsyncReturnType } from "@trpc/server";
import { z } from "zod";
import { createTRPCContext } from "~/server/api/trpc";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const tweetRouter = createTRPCRouter({
  infinteFeedProfile: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        userId: z.string(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ input: { limit = 10, cursor, userId }, ctx }) => {
      const currentUserId = ctx.session?.user.id;
      return await getInfiniteTweets({
        ctx,
        limit,
        cursor,
        whereClause: { userId },
      });
    }),
  infiniteFeed: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        onlyFollowing: z.boolean().optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(
      async ({ input: { limit = 10, cursor, onlyFollowing = false }, ctx }) => {
        const currentUserId = ctx.session?.user.id;
        return await getInfiniteTweets({
          ctx,
          limit,
          cursor,
          whereClause:
            !onlyFollowing || !currentUserId
              ? undefined
              : {
                  user: {
                    followers: {
                      some: {
                        id: currentUserId,
                      },
                    },
                  },
                },
        });
      }
    ),
  create: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input: { content }, ctx }) => {
      const tweet = await ctx.prisma.tweet.create({
        data: { content, userId: ctx.session.user.id },
      });
      void ctx.revalidateSSG?.(`/profiles/${ctx.session.user.id}`);

      return tweet;
    }),
  deleteTweet: protectedProcedure
    .input(z.object({ tweetId: z.string() }))
    .mutation(async ({ input: { tweetId }, ctx }) => {
      if (!tweetId) return null;
      const currentUserId = ctx.session.user.id;
      const tweetAuthor = await ctx.prisma.tweet.findFirst({
        where: { id: tweetId },
        select: { userId: true },
      });
      if (currentUserId != tweetAuthor?.userId) return false;
      await ctx.prisma.tweet.delete({
        where: {
          id: tweetId,
        },
      });

      return true;
    }),
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      const data = { tweetId: id, userId: ctx.session.user.id };
      const existingLike = await ctx.prisma.like.findUnique({
        where: { userId_tweetId: data },
      });

      if (existingLike == null) {
        await ctx.prisma.like.create({
          data,
        });
        return { addedLike: true };
      } else {
        await ctx.prisma.like.delete({
          where: { userId_tweetId: data },
        });
        return { addedLike: false };
      }
    }),
});

async function getInfiniteTweets({
  whereClause,
  ctx,
  limit,
  cursor,
}: {
  whereClause?: Prisma.TweetWhereInput;
  ctx: inferAsyncReturnType<typeof createTRPCContext>;
  limit: number;
  cursor: { id: string; createdAt: Date } | undefined;
}) {
  const currentUserId = ctx.session?.user.id;
  const data = await ctx.prisma.tweet.findMany({
    take: limit + 1,
    cursor: cursor ? { createdAt_id: cursor } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: whereClause,
    select: {
      id: true,
      content: true,
      createdAt: true,
      _count: { select: { Like: true } },
      user: {
        select: { name: true, id: true, image: true },
      },
      Like:
        currentUserId == null ? false : { where: { userId: currentUserId } },
    },
  });

  let nextCursor: typeof cursor | undefined;
  if (data.length > limit) {
    const nextItem = data.pop();
    if (nextItem) {
      nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
    }
  }

  return {
    tweets: data.map((tweet) => {
      return {
        id: tweet.id,
        content: tweet.content,
        createdAt: tweet.createdAt,
        likeCount: tweet._count.Like,
        user: tweet.user,
        likedByMe: tweet.Like?.length > 0,
      };
    }),
    nextCursor,
  };
}
