import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { studentRouter } from "./student.router";
import { mediaFileRouter } from "./media_file.router";
import { analysisRouter } from "./analysis.router";  // Add this
import z from "zod";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	helloWorld: publicProcedure.query(() => {
		return "Hello World";
	}),
	testPost: publicProcedure
		.input(
			z.object({
				name: z.string(),
			})
		)
		.mutation(({ input }) => {
			return {
				message: "Hello World",
			};
		}),

	students: studentRouter,
	mediaFiles: mediaFileRouter,
	analysis: analysisRouter,  // Add this
});
export type AppRouter = typeof appRouter;