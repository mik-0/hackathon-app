import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { MediaFile } from "@/db/models/media_file.model";
import fs from "fs/promises";

/**
 * 🎓 STUDENT ROUTER - tRPC Beginner's Guide
 *
 * BACKEND (this file):
 * - Use .query() for READ operations (GET)
 * - Use .mutation() for WRITE operations (POST/PUT/DELETE)
 * - Use .input() with Zod for validation
 * - Use publicProcedure (no auth) or protectedProcedure (requires login)
 * - Import Mongoose models directly, no need for context
 *
 * FRONTEND usage:
 *
 * // Get all students
 * const students = useQuery(trpc.students.getAll.queryOptions());
 *
 * // Get one student
 * const student = useQuery(trpc.students.getById.queryOptions({ id: "123" }));
 *
 * // Create student (mutation)
 * const createStudent = useMutation(trpc.students.create.mutationOptions());
 * createStudent.mutate({ name: "John", studentNumber: 12345, email: "john@example.com" });
 *
 * // Update student
 * const updateStudent = useMutation(trpc.students.update.mutationOptions());
 * updateStudent.mutate({ id: "123", name: "Jane" });
 *
 * // Delete student
 * const deleteStudent = useMutation(trpc.students.delete.mutationOptions());
 * deleteStudent.mutate({ id: "123" });
 *
 * // Search students
 * const results = useQuery(trpc.students.search.queryOptions({ query: "John" }));
 */


export const mediaFileRouter = router({
	// READ: Get all media files
	getAll: publicProcedure.query(async () => {
		const files = await MediaFile.find().sort({ createdAt: -1 }).lean();
		return files;
	}),

	// READ: Get one media file by ID
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			const file = await MediaFile.findById(input.id).lean();
			if (!file) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media file not found",
				});
			}
			return file;
		}),

	// DELETE: Remove media file (protected - auth required)
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			const file = await MediaFile.findByIdAndDelete(input.id);
			if (!file) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media file not found",
				});
			}

			if (file.filePath) {
				try {
					await fs.unlink(file.filePath);
				} catch (err) {
					console.error("Failed to delete file:", err);
				}
			}
			return { success: true, deletedId: input.id };
		}),
})
