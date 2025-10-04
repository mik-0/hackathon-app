import { publicProcedure, router } from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { MediaFile } from "@/db/models/media_file.model";

export const analysisRouter = router({
	// Trigger analysis for a media file
	startAnalysis: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			const file = await MediaFile.findById(input.id);
			
			if (!file) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Media file not found",
				});
			}

			if (!file.transcript || file.status !== "complete") {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Transcription must be complete before analysis",
				});
			}

			// Update status to processing
			await MediaFile.findByIdAndUpdate(input.id, {
				analysisStatus: "processing",
			});

			// Run analysis asynchronously
			(async () => {
				try {
					console.log(`🔍 Starting analysis for ${file.filename}...`);

					// Prepare segments for analysis
					const segments = file.transcript!.segments.map((seg) => ({
						text: seg.text,
						start: seg.start,
						end: seg.end,
					}));

					// Call Python analysis service
					const response = await fetch(
						`${process.env.ANALYSIS_API_URL || "http://localhost:8001"}/analyze`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ segments }),
						}
					);

					if (!response.ok) {
						const errorText = await response.text();
						console.error("❌ Analysis failed:", response.status, errorText);
						
						await MediaFile.findByIdAndUpdate(input.id, {
							analysisStatus: "error",
						});
						return;
					}

					const analyzedSegments = await response.json();
					console.log("✅ Analysis complete for:", file.filename);

					// Update transcript with analysis results
					const updatedTranscript = { ...file.transcript };
					updatedTranscript.segments = file.transcript!.segments.map((seg, idx) => {
						const analyzed = analyzedSegments[idx];
						return {
							...seg,
							isExtremist: analyzed.isExtremist,
							classType: analyzed.class_type,
							confidence: analyzed.confidence,
						};
					});

					// Save to database
					await MediaFile.findByIdAndUpdate(input.id, {
						transcript: updatedTranscript,
						analysisStatus: "complete",
					});

				} catch (error) {
					console.error("❌ Analysis error:", error);
					await MediaFile.findByIdAndUpdate(input.id, {
						analysisStatus: "error",
					});
				}
			})();

			return { 
				success: true, 
				message: "Analysis started" 
			};
		}),

	// Get analysis status
	getAnalysisStatus: publicProcedure
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
				analysisStatus: file.analysisStatus || "pending",
				transcript: file.transcript,
			};
		}),
});