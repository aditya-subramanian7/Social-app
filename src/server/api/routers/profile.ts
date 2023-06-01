import { Prisma } from "@prisma/client";
import { inferAsyncReturnType } from "@trpc/server";
import { z } from "zod";
import { createTRPCContext } from "~/server/api/trpc";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { prisma } from "~/server/db";

export const profileRouter = createTRPCRouter({
  toggleFollow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input: { userId }, ctx }) => {
      const currentUserId = ctx.session.user.id;
      const existingFollow = await ctx.prisma.user.findFirst({
        where: { id: userId, followers: { some: { id: currentUserId } } },
      });
      console.log(existingFollow);
      let addedFollow;
      if (!existingFollow) {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { followers: { connect: { id: currentUserId } } },
        });
        addedFollow = true;
      } else {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { followers: { disconnect: { id: currentUserId } } },
        });
        addedFollow = false;
      }

      void ctx.revalidateSSG?.(`/profiles/${userId}`);
      void ctx.revalidateSSG?.(`/profiles/${currentUserId}`);
      return { addedFollow };

      // return { addedFollow };
    }),
  getProfileById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input: { id }, ctx }) => {
      const currentUserId = ctx.session?.user.id;
      const profile = await prisma.user.findUnique({
        where: { id },
        select: {
          name: true,
          image: true,
          followers:
            currentUserId == null
              ? undefined
              : {
                  where: {
                    id: currentUserId,
                  },
                },
          _count: { select: { followers: true, follows: true, tweets: true } },
        },
      });

      if (!profile) {
        return;
      }
      return {
        name: profile.name,
        image: profile.image,
        isFollowing: profile.followers.length > 0,
        followerCount: profile._count.followers,
        followsCount: profile._count.follows,
        tweetsCount: profile._count.tweets,
      };
    }),
});

export default profileRouter;
