import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { MediaFile } from "@/db/models/media_file.model";
import fs from "fs/promises";

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

	// READ: Get transcription status and data
	getTranscriptionStatus: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			const file = await MediaFile.findById(input.id).lean();
			if (!file) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media file not found",
				});
			}
			return {
				status: file.status,
				transcript: file.transcript,
				filename: file.filename,
				fileType: file.fileType,
				durationSec: file.durationSec,
			};
		}),
});
