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
		}>;
	};
	analysisStatus?: "pending" | "processing" | "complete" | "error";  // Added
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
	},
	{
		collection: "media_files",
		timestamps: true,
	}
);

const MediaFile = model<IMediaFile>("MediaFile", mediaFileSchema);

export { MediaFile };