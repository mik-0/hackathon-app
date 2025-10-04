// Collection to store metadata of uploaded audio/video files
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export interface IMediaFile {
	_id: mongoose.Types.ObjectId | string;
	filename: string;
	filePath: string;
	fileType: "audio" | "video";
	durationSec?: number;
	status: "in-progress" | "complete" | "error" | "processing";
	language: string;
	transcript?: {
		language: string;
		language_probability: number;
		duration: number;
		segments: Array<{
			start: number;
			end: number;
			text: string;
			isExtremist?: boolean;  // Added
			classType?: string;      // Added
			confidence?: number;     // Added
			words?: Array<{
				start: number;
				end: number;
				word: string;
			}>;
			extremistConfidence?: number;
			extremistReasoning?: string;
		}>;
	};
	analysisStatus?: "pending" | "processing" | "complete" | "error";  // Added
	analyzedForExtremism: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const mediaFileSchema = new Schema<IMediaFile>(
	{
		filename: { type: String, required: true },
		filePath: { type: String, required: true },
		fileType: { type: String, enum: ["audio", "video"], required: true },
		durationSec: { type: Number },
		status: {
			type: String,
			enum: ["in-progress", "complete", "error", "processing"],
			default: "in-progress",
		},
		language: { type: String, required: true, default: "en" },
		transcript: { type: Schema.Types.Mixed },
		analysisStatus: { 
			type: String, 
			enum: ["pending", "processing", "complete", "error"],
			default: "pending"
		},
		analyzedForExtremism: { type: Boolean, default: false },
	},
	{
		collection: "media_files",
		timestamps: true,
	}
);

const MediaFile = model<IMediaFile>("MediaFile", mediaFileSchema);
mediaFileSchema.post('save', async function(file) {
  try {
    if (file.analyzedForExtremism || !file.transcript || !file.transcript.segments || file.transcript.segments.length === 0) {
      return;
    }

    const { default: lemonadeService } = await import('../../services/lemonade.service');
    console.log("Analyzing segments for extremist content.");

    for (let i = 0; i < file.transcript.segments.length; i++) {
      const segment = file.transcript.segments[i];

      try {
        // Analyze segment for extremist content
        const analysis = await lemonadeService.analyzeExtremistContent(segment.text);

        // Update segment with analysis results
        file.transcript.segments[i].isExtremist = analysis.isExtremist;
        file.transcript.segments[i].extremistConfidence = analysis.confidence;
        file.transcript.segments[i].extremistReasoning = analysis.reasoning;

        console.log(`Segment ${i + 1}: ${analysis.isExtremist ? 'EXTREMIST' : 'Safe'} (confidence: ${analysis.confidence})`);

        // Small delay to avoid overwhelming the LLM
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to analyze segment ${i + 1}:`, error);
        // Mark as safe if analysis fails
        file.transcript.segments[i].isExtremist = false;
        file.transcript.segments[i].extremistConfidence = 0;
        file.transcript.segments[i].extremistReasoning = 'Analysis failed';
      }
    }

    // Save the updated media file
	await MediaFile.updateOne(
		{ _id: file._id },
		{
		  $set: {
			transcript: file.transcript,
			analyzedForExtremism: true
		  }
		}
	);

    const extremistCount = file.transcript.segments.filter(s => s.isExtremist).length;
    console.log(`Analysis complete for ${file.filename}: ${extremistCount}/${file.transcript.segments.length} segments flagged as extremist`);

  } catch (error) {
    console.error(`Extremist analysis failed for media file ${file._id}:`, error);
  }
});

export { MediaFile };
