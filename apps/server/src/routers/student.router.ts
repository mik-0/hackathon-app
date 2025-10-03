import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { Student } from "../db/models/student.model";
import { TRPCError } from "@trpc/server";
import z from "zod";

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
export const studentRouter = router({
	// 📖 READ: Get all students (public)
	getAll: publicProcedure.query(async () => {
		const students = await Student.find().sort({ createdAt: -1 }).lean();
		return students;
	}),

	// 📖 READ: Get one student by ID (public)
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			const student = await Student.findById(input.id).lean();
			if (!student) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Student not found",
				});
			}
			return student;
		}),

	// ✍️ CREATE: Add new student (protected - auth required)
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1, "Name is required"),
				studentNumber: z.number().positive("Must be positive"),
				email: z.string().email("Invalid email"),
			})
		)
		.mutation(async ({ input }) => {
			const student = await Student.create({
				...input,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			return student.toObject();
		}),

	// 🔄 UPDATE: Edit student (protected)
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				email: z.string().email().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const { id, ...updates } = input;
			const student = await Student.findByIdAndUpdate(
				id,
				{ ...updates, updatedAt: new Date() },
				{ new: true, lean: true } // Return updated document as plain object
			);
			if (!student) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Student not found",
				});
			}
			return student;
		}),

	// 🗑️ DELETE: Remove student (protected)
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			const student = await Student.findByIdAndDelete(input.id);
			if (!student) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Student not found",
				});
			}
			return { success: true, deletedId: input.id };
		}),

	// 🔍 SEARCH: Find students by name (public)
	search: publicProcedure
		.input(z.object({ query: z.string().min(1) }))
		.query(async ({ input }) => {
			const students = await Student.find({
				name: { $regex: input.query, $options: "i" }, // Case-insensitive
			})
				.limit(20)
				.lean();
			return students;
		}),
});
