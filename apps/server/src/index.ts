import "dotenv/config";
import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "./lib/auth";
import fs from "fs";
import path from "path";
import { MediaFile } from "./db/models/media_file.model";
import { randomUUID } from "crypto";
import busboy from "busboy";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
	fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

import OpenAI from "openai";
export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Supported MIME types
const SUPPORTED_FORMATS: Record<string, string> = {
	// Video formats
	".mp4": "video/mp4",
	".webm": "video/webm",
	// '.ogg': 'video/ogg',
	".ogv": "video/ogg",
	".mov": "video/quicktime",
	".avi": "video/x-msvideo",
	".mkv": "video/x-matroska",
	".m4v": "video/x-m4v",
	".flv": "video/x-flv",
	// Audio formats
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".m4a": "audio/mp4",
	".aac": "audio/aac",
	".flac": "audio/flac",
	".oga": "audio/ogg",
	".opus": "audio/opus",
	".weba": "audio/webm",
	".ogg": "audio/ogg",
};

const app = new Elysia({ adapter: node() })
	.use(
		cors({
			origin: process.env.CORS_ORIGIN || "",
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		})
	)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.all("/trpc/*", async (context) => {
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		return res;
	})
	.get("/", () => "OK")
	// ============================================
	// UPLOAD ENDPOINT
	// ============================================
	.post("/api/upload", async ({ request, set }) => {
		let filePath: string | null = null;
		let mediaFileId: string | null = null;

		try {
			// For very large files, we need to parse multipart data as a stream
			// This prevents loading the entire file into memory
			const contentType = request.headers.get("content-type") || "";

			if (!contentType.includes("multipart/form-data")) {
				set.status = 400;
				return { error: "Content-Type must be multipart/form-data" };
			}

			// Convert Headers to plain object for busboy
			// Busboy needs the headers as a plain object with lowercase keys
			const headersObj: Record<string, string> = {};
			for (const [key, value] of request.headers.entries()) {
				headersObj[key.toLowerCase()] = value;
			}

			// Use busboy for streaming multipart parsing
			const bb = busboy({
				headers: headersObj,
				limits: {
					fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit
				},
			});

			let uploadedFile: {
				filename: string;
				mimeType: string;
				size: number;
				filePath: string;
			} | null = null;

			let formFields: Record<string, string> = {};
			let uploadError: string | null = null;
			let fileUploadInProgress = false;
			let fileUploadPromise: Promise<void> | null = null;

			// Promise to wait for upload completion
			const uploadPromise = new Promise<void>((resolve, reject) => {
				// Handle file upload
				bb.on(
					"file",
					(
						fieldname: string,
						fileStream: NodeJS.ReadableStream,
						info: {
							filename: string;
							encoding: string;
							mimeType: string;
						}
					) => {
						fileUploadInProgress = true;
						fileUploadPromise = (async () => {
							try {
								const { filename, mimeType } = info;

								// Validate file type
								const isVideo = mimeType.startsWith("video/");
								const isAudio = mimeType.startsWith("audio/");

								if (!isVideo && !isAudio) {
									fileStream.resume(); // Drain the stream
									uploadError =
										"Only video and audio files are allowed";
									return;
								}

								// Validate file extension
								const ext = path
									.extname(filename)
									.toLowerCase();
								if (!SUPPORTED_FORMATS[ext]) {
									fileStream.resume();
									uploadError = `Unsupported file format: ${ext}`;
									return;
								}

								// Generate unique filename
								const uniqueFilename = `${randomUUID()}${ext}`;
								filePath = path.join(
									UPLOAD_DIR,
									uniqueFilename
								);

								// Create write stream
								const writeStream =
									fs.createWriteStream(filePath);
								let bytesWritten = 0;

								// Track bytes written
								fileStream.on("data", (chunk: Buffer) => {
									bytesWritten += chunk.length;
								});

								// Pipe with error handling and backpressure
								fileStream.pipe(writeStream);

								// Wait for completion
								await new Promise<void>(
									(resolveFile, rejectFile) => {
										writeStream.on("finish", () => {
											uploadedFile = {
												filename,
												mimeType,
												size: bytesWritten,
												filePath: filePath!,
											};
											resolveFile();
										});
										writeStream.on("error", rejectFile);
										fileStream.on("error", rejectFile);
									}
								);
							} catch (err) {
								uploadError =
									err instanceof Error
										? err.message
										: "Unknown upload error";
							} finally {
								fileUploadInProgress = false;
							}
						})();
					}
				);

				// Handle form fields (metadata)
				bb.on("field", (fieldname: string, value: string) => {
					formFields[fieldname] = value;
				});

				// Handle size limit exceeded
				bb.on("limit", () => {
					uploadError = "File size exceeds 5GB limit";
				});

				// Handle completion
				bb.on("finish", async () => {
					// Wait for file upload to complete if still in progress
					if (fileUploadPromise) {
						await fileUploadPromise;
					}

					if (uploadError) {
						reject(uploadError);
					} else {
						resolve();
					}
				});

				// Handle errors
				bb.on("error", (err: Error) => {
					reject(err);
				});
			});

			// Pipe request body to busboy
			const reader = request.body?.getReader();
			if (!reader) {
				set.status = 400;
				return { error: "No request body" };
			}

			// Stream the request body to busboy
			(async () => {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							bb.end();
							break;
						}
						bb.write(Buffer.from(value));
					}
				} catch (err) {
					bb.emit("error", err);
				}
			})();

			// Wait for upload to complete
			await uploadPromise;

			// Type guard: ensure uploadedFile exists
			if (!uploadedFile) {
				set.status = 400;
				return { error: uploadError || "No file uploaded" };
			}

			// Explicit type assertion after null check
			const uploadedFileData: {
				filename: string;
				mimeType: string;
				size: number;
				filePath: string;
			} = uploadedFile;

			const {
				filename,
				mimeType,
				size,
				filePath: uploadedFilePath,
			} = uploadedFileData;
			const fileType: "video" | "audio" = mimeType.startsWith("video/")
				? "video"
				: "audio";

			// Save to MongoDB
			const mediaFile = new MediaFile({
				filename: filename,
				filePath: uploadedFilePath,
				fileType,
				durationSec: formFields.duration
					? parseFloat(formFields.duration)
					: undefined,
				status: "processing" as const,
				language: formFields.language || "en",
			});

			await mediaFile.save();
			mediaFileId = mediaFile._id.toString();

			// Process transcription asynchronously (don't wait for it)
			// This allows us to return immediately to the user
			(async () => {
				try {
					console.log(`🎙️ Starting transcription for ${filename}...`);

					const transcription =
						await openai.audio.transcriptions.create({
							file: fs.createReadStream(uploadedFilePath),
							model: "whisper-1",
							response_format: "verbose_json",
						});

					if (!transcription) {
						console.error(
							"❌ Transcription failed:",
							transcription
						);

						// Update media file status to error
						await MediaFile.findByIdAndUpdate(mediaFileId, {
							status: "error",
						});
						return;
					}

					console.log("✅ Transcription complete for:", filename);

					// Save transcript to database
					await MediaFile.findByIdAndUpdate(mediaFileId, {
						status: "complete",
						transcript: transcription,
					});
				} catch (error) {
					console.error("❌ Transcription error:", error);
					// Update media file status to error
					try {
						await MediaFile.findByIdAndUpdate(mediaFileId, {
							status: "error",
						});
					} catch (dbError) {
						console.error(
							"Failed to update error status:",
							dbError
						);
					}
				}
			})();

			// Return immediately without waiting for transcription
			return {
				success: true,
				message:
					"File uploaded successfully. Transcription in progress.",
				file: {
					id: mediaFile._id.toString(),
					filename: mediaFile.filename,
					fileType: mediaFile.fileType,
					durationSec: mediaFile.durationSec,
					status: "processing" as const,
					language: mediaFile.language,
					createdAt: mediaFile.createdAt,
					size: size,
				},
			};
		} catch (error) {
			console.error("Upload error:", error);

			// Clean up on error
			if (filePath && fs.existsSync(filePath)) {
				try {
					await fs.promises.unlink(filePath);
				} catch (cleanupError) {
					console.error("Failed to clean up file:", cleanupError);
				}
			}

			// Update database status to error
			if (mediaFileId) {
				try {
					await MediaFile.findByIdAndUpdate(mediaFileId, {
						status: "error",
					});
				} catch (dbError) {
					console.error("Failed to update error status:", dbError);
				}
			}

			set.status = 500;
			return {
				error: "Upload failed",
				details:
					error instanceof Error ? error.message : "Unknown error",
			};
		}
	})
	// ============================================
	// STREAMING ENDPOINT
	// ============================================
	.get("/api/stream/:id", async ({ params, request, set }) => {
		try {
			const mediaFile = await MediaFile.findById(params.id);

			if (!mediaFile || !mediaFile.filePath) {
				set.status = 404;
				return { error: "File not found" };
			}

			const filePath = mediaFile.filePath;

			// Check if file exists
			if (!fs.existsSync(filePath)) {
				set.status = 404;
				return { error: "File not found on disk" };
			}

			const stat = fs.statSync(filePath);
			const fileSize = stat.size;
			const range = request.headers.get("range");

			// Determine MIME type
			const ext = path.extname(filePath).toLowerCase();
			const mimeType = SUPPORTED_FORMATS[ext];

			if (!mimeType) {
				set.status = 415;
				return { error: "Unsupported file format" };
			}

			if (range) {
				// Validate and parse Range header
				const rangeParts = range.replace(/bytes=/, "").split("-");
				const start = parseInt(rangeParts[0], 10);
				const end = rangeParts[1]
					? parseInt(rangeParts[1], 10)
					: fileSize - 1;

				// Validate range values
				if (
					isNaN(start) ||
					isNaN(end) ||
					start < 0 ||
					end >= fileSize ||
					start > end
				) {
					set.status = 416; // Range Not Satisfiable
					return { error: "Invalid range" };
				}

				const chunkSize = end - start + 1;

				// Create read stream for the requested range
				const stream = fs.createReadStream(filePath, { start, end });

				// Convert Node stream to Web ReadableStream with error handling
				const webStream = new ReadableStream({
					start(controller) {
						stream.on("data", (chunk: string | Buffer) => {
							try {
								const buffer =
									typeof chunk === "string"
										? Buffer.from(chunk)
										: chunk;
								controller.enqueue(new Uint8Array(buffer));
							} catch (err) {
								controller.error(err);
								stream.destroy();
							}
						});
						stream.on("end", () => {
							controller.close();
						});
						stream.on("error", (err) => {
							console.error("Stream error:", err);
							controller.error(err);
						});
					},
					cancel() {
						stream.destroy();
					},
				});

				return new Response(webStream, {
					status: 206,
					headers: {
						"Content-Range": `bytes ${start}-${end}/${fileSize}`,
						"Accept-Ranges": "bytes",
						"Content-Length": chunkSize.toString(),
						"Content-Type": mimeType,
					},
				});
			} else {
				// No range header, stream entire file
				const stream = fs.createReadStream(filePath);

				// Convert Node stream to Web ReadableStream with error handling
				const webStream = new ReadableStream({
					start(controller) {
						stream.on("data", (chunk: string | Buffer) => {
							try {
								const buffer =
									typeof chunk === "string"
										? Buffer.from(chunk)
										: chunk;
								controller.enqueue(new Uint8Array(buffer));
							} catch (err) {
								controller.error(err);
								stream.destroy();
							}
						});
						stream.on("end", () => {
							controller.close();
						});
						stream.on("error", (err) => {
							console.error("Stream error:", err);
							controller.error(err);
						});
					},
					cancel() {
						stream.destroy();
					},
				});

				return new Response(webStream, {
					headers: {
						"Content-Length": fileSize.toString(),
						"Content-Type": mimeType,
						"Accept-Ranges": "bytes",
					},
				});
			}
		} catch (error) {
			console.error("Streaming error:", error);
			set.status = 500;
			return {
				error: "Streaming failed",
				details: error instanceof Error ? error.message : "Unknown",
			};
		}
	})
	// ============================================
	// SIMPLE FILE SERVING ENDPOINT
	// ============================================
	.get("/uploads/:id", async ({ params, set }) => {
		try {
			const mediaFile = await MediaFile.findById(params.id);

			if (!mediaFile || !mediaFile.filePath) {
				set.status = 404;
				return { error: "File not found" };
			}

			const filePath = mediaFile.filePath;

			// Check if file exists
			if (!fs.existsSync(filePath)) {
				set.status = 404;
				return { error: "File not found on disk" };
			}

			// Determine MIME type
			const ext = path.extname(filePath).toLowerCase();
			const mimeType =
				SUPPORTED_FORMATS[ext] || "application/octet-stream";

			// Read the file
			const fileBuffer = fs.readFileSync(filePath);

			// Return the file with appropriate headers
			return new Response(fileBuffer, {
				headers: {
					"Content-Type": mimeType,
					"Content-Length": fileBuffer.length.toString(),
					"Accept-Ranges": "bytes",
				},
			});
		} catch (error) {
			console.error("File serving error:", error);
			set.status = 500;
			return {
				error: "Failed to serve file",
				details: error instanceof Error ? error.message : "Unknown",
			};
		}
	})
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});
