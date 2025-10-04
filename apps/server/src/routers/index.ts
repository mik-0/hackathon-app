import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { studentRouter } from "./student.router";
import { mediaFileRouter } from "./media_file.router";
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

	// 🎓 Nested router - all student endpoints under "students.*"
	students: studentRouter,
	// 📁 Media file endpoints under "mediaFiles.*"
	mediaFiles: mediaFileRouter,
});
export type AppRouter = typeof appRouter;
