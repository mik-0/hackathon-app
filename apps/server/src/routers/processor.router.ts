import { MediaFile } from "@/db/models/media_file.model";
import { publicProcedure, router } from "@/lib/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { openai } from "..";

export const processorRouter = router({
	processAudio: publicProcedure
		.input(
			z.object({
				mediaId: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			const { mediaId } = input;
			const mediaFile = await MediaFile.findById(mediaId);
			if (!mediaFile) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media file not found",
				});
			}

			// Set processing status to processing
			mediaFile.processingStatus = "processing";
			await mediaFile.save();

			try {
				const processedTranscription = mediaFile.transcript?.segments
					.map((segment, index) => {
						return `<${index}> ${segment.text} </${index}>`;
					})
					.join("");
				console.log("Processed transcription:", processedTranscription);

				const response = await openai.responses.create({
					model: "gpt-5-mini",
					input: `You are to flag EXTREMIST_SPEECH or BAD_LANGUAGE in the text below. Give it in the format of "INDEX:CATEGORY;" for EVERY offending segment: ${processedTranscription}`,
				});

				console.log("Response:", response.output_text);

				const flaggedSegments = response.output_text.split(";");
				console.log("Flagged segments:", flaggedSegments);

				const flaggedSegmentsArray = flaggedSegments.map((segment) => {
					return {
						index: segment.split(":")[0],
						category: segment.split(":")[1],
					};
				});

				console.log("Flagged segments array:", flaggedSegmentsArray);
				console.log(
					"Total flagged segments to process:",
					flaggedSegmentsArray.length
				);
				console.log(
					"Original transcript segments count:",
					mediaFile.transcript?.segments.length
				);

				for (const flaggedSegment of flaggedSegmentsArray) {
					console.log("Processing flagged segment:", flaggedSegment);
					console.log("Segment index:", flaggedSegment.index);
					console.log("Segment category:", flaggedSegment.category);

					try {
						const segmentIndex = parseInt(flaggedSegment.index);
						console.log("Parsed segment index:", segmentIndex);

						if (isNaN(segmentIndex)) {
							console.warn(
								"Invalid segment index - not a number:",
								flaggedSegment.index
							);
							continue;
						}

						if (!mediaFile.transcript?.segments[segmentIndex]) {
							console.warn(
								"Segment not found at index:",
								segmentIndex
							);
							continue;
						}

						console.log(
							"Original segment before update:",
							mediaFile.transcript.segments[segmentIndex]
						);

						mediaFile.transcript!.segments[segmentIndex].category =
							flaggedSegment.category as
								| "EXTREMIST_SPEECH"
								| "BAD_LANGUAGE";

						console.log(
							"Updated segment after category assignment:",
							mediaFile.transcript.segments[segmentIndex]
						);
					} catch (error) {
						console.error("Error updating flagged segment:", error);
						console.error("Failed segment data:", flaggedSegment);
					}
				}

				console.log("Saving media file to database...");
				mediaFile.processingStatus = "complete";
				mediaFile.markModified("transcript"); // Tell Mongoose that transcript was modified
				await mediaFile.save();
				console.log("Media file saved successfully");

				console.log(
					"Final media file with updated segments:",
					JSON.stringify(mediaFile.transcript?.segments, null, 2)
				);

				return {
					success: true,
					message: "Audio processed successfully",
				};
			} catch (error) {
				console.error("Error processing audio:", error);
				mediaFile.processingStatus = "error";
				await mediaFile.save();
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to process audio",
				});
			}
		}),
});
