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
					input: `You are a linguistic and social safety classifier trained to detect **extremist** and **hateful** speech.
Your task is to review text segments and flag any that contain one or more of the following:

1. **EXTREMIST_SPEECH** — advocacy or justification of violence, terrorism, or exclusionary ideologies.
   Includes calls for violence, dehumanizing language, or rhetoric promoting supremacy of a group.
2. **BAD_LANGUAGE** — profanity, slurs, or explicit insults targeting individuals or groups.

You must return results in this strict format:
"INDEX:CATEGORY;INDEX:CATEGORY;..."
(no quotes, no explanations)

Each INDEX corresponds to the 0-based position of the segment in the input array or block.

Be **precise** — do not flag neutral or factual statements, even if they mention sensitive topics.
Be **comprehensive** — flag all explicit and implicit extremist or hateful content.

Few-shot examples:
------------------
Example 1:
Input: ["<0>We must wipe them out completely.</0>", "<1>The sky is blue today.</1>"]
Output: 0:EXTREMIST_SPEECH;

Example 2:
Input: ["<0>These people are scum.</0>", "<1>Let's all live peacefully together.</1>"]
Output: 0:BAD_LANGUAGE;

Example 3:
Input: ["<0>We must take our country back from the corrupt politicians.<0>",
        "<1>Let's burn down their offices.</1>"]
Output: 1:EXTREMIST_SPEECH;

Example 4:
Input: ["<0>I hate those idiots!<0>", "<1>But maybe we can talk it out.<1>"]
Output: 0:BAD_LANGUAGE;

If nothing qualifies, output an empty string ("").
------------------

Evaluate the following text segments and flag them accordingly:
${processedTranscription}
  `,
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
