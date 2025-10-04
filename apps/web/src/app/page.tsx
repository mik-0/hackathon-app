"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import { useState, useEffect, useRef } from "react";
import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Pause, Play, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AudioSegment from "@/components/AudioSegment";
import WaveformSegmentOverlay from "@/components/WaveformSegmentOverlay";

export default function Home() {
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [mediaFileId, setMediaFileId] = useState<string | null>(null);
	const [segments, setSegments] = useState<
		{
			startTime: number;
			endTime: number;
			segment: string;
			isExtremist: boolean;
		}[]
	>([]);
	const [transcriptionStatus, setTranscriptionStatus] = useState<
		"idle" | "uploading" | "processing" | "complete" | "error"
	>("idle");

	const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
	const toastIdRef = useRef<string | number | null>(null);

	const { mutateAsync: uploadFile } = useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file);
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/api/upload`,
				{
					method: "POST",
					body: formData,
				}
			);
			return response.json();
		},
	});

	const recorderControls = useVoiceVisualizer({});
	const currentTime = recorderControls.currentAudioTime;
	const duration = recorderControls.duration;

	// Auto-poll transcription status using React Query's refetchInterval
	const { data: transcriptionData } = useQuery(
		trpc.mediaFiles.getTranscriptionStatus.queryOptions(
			{
				id: mediaFileId!,
			},
			{
				enabled: !!mediaFileId && transcriptionStatus === "processing",
				refetchInterval: 3000, // Poll every 3 seconds
			}
		)
	);

	// Handle transcription status changes
	useEffect(() => {
		if (!transcriptionData) return;

		if (
			transcriptionData.status === "complete" &&
			transcriptionData.transcript
		) {
			setTranscriptionStatus("complete");

			// Transform transcript segments to display format
			const transformedSegments =
				transcriptionData.transcript.segments.map((seg: any) => ({
					startTime: seg.start,
					endTime: seg.end,
					segment: seg.text,
					isExtremist: false, // This will be set by analysis
				}));

			setSegments(transformedSegments);
			toast.success("Transcription complete! 🎉", {
				id: toastIdRef.current ?? undefined,
			});
		} else if (transcriptionData.status === "error") {
			setTranscriptionStatus("error");
			toast.error("Transcription failed", {
				id: toastIdRef.current ?? undefined,
			});
		}
	}, [transcriptionData]);

	const handleDrop = async (files: File[]) => {
		setTranscriptionStatus("uploading");
		const toastId = toast.loading("Uploading file...");
		toastIdRef.current = toastId;

		try {
			const result = await uploadFile(files[0]);

			if (!result.success) {
				toast.error("Upload failed", { id: toastId });
				setTranscriptionStatus("error");
				return;
			}

			setMediaFileId(result.file.id);
			setAudioFile(files[0]);
			recorderControls.setPreloadedAudioBlob(files[0]);
			// recorderControls.startAudioPlayback();

			setTranscriptionStatus("processing");
			toast.loading("Transcribing audio... This may take a while", {
				id: toastId,
			});
		} catch (error) {
			toast.error("Something went wrong: " + error, { id: toastId });
			setTranscriptionStatus("error");
			console.log(error);
		}
	};

	const handleError = (error: Error) => {
		console.log(error);
		toast.error(`Something went wrong: ${error.message}`);
	};

	const handleSeekToTime = (timeInSeconds: number) => {
		if (recorderControls.audioRef.current) {
			const wasPlaying = !recorderControls.isPausedRecordedAudio;

			recorderControls.audioRef.current.currentTime = timeInSeconds;

			if (wasPlaying || recorderControls.isPausedRecordedAudio) {
				recorderControls.startAudioPlayback();
			}
		}
	};

	const isSegmentActive = (startTime: number, endTime: number) => {
		return currentTime >= startTime && currentTime < endTime;
	};

	// const segments = [
	// 	{
	// 		startTime: 0,
	// 		endTime: 4,
	// 		segment:
	// 			"Welcome everyone to today's discussion about community safety and security measures.",
	// 		isExtremist: false,
	// 	},
	// 	{
	// 		startTime: 4,
	// 		endTime: 8,
	// 		segment:
	// 			"We need to take immediate action against those who threaten our way of life and values.",
	// 		isExtremist: true,
	// 	},
	// 	{
	// 		startTime: 8,
	// 		endTime: 12,
	// 		segment:
	// 			"Education and dialogue are the best tools we have for building understanding between different groups.",
	// 	},
	// 	{
	// 		startTime: 12,
	// 		endTime: 16,
	// 		segment:
	// 			"They are the enemy and must be stopped by any means necessary before they destroy everything we hold dear.",
	// 		isExtremist: true,
	// 	},
	// 	{
	// 		startTime: 16,
	// 		endTime: 20,
	// 		segment:
	// 			"Let's focus on constructive solutions that bring people together rather than divide them.",
	// 	},
	// 	{
	// 		startTime: 20,
	// 		endTime: 24,
	// 		segment:
	// 			"Thank you for listening and remember to stay engaged in your local community initiatives.",
	// 	},
	// ];

	// Auto-scroll to active segment

	useEffect(() => {
		const activeIndex = segments.findIndex((seg) =>
			isSegmentActive(seg.startTime, seg.endTime)
		);

		if (activeIndex !== -1 && segmentRefs.current[activeIndex]) {
			segmentRefs.current[activeIndex]?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}
	}, [currentTime]);

	return (
		<div className="container mx-auto max-w-3xl px-4 space-y-8 py-8 flex flex-col items-center">
			<div className="self-start">
				<h1 className="text-2xl font-bold">Extremism Detector</h1>
				<p>
					Upload an audio or video file to detect potential extremist
					segments.
				</p>
			</div>
			<Dropzone
				accept={{ "audio/*": [] }}
				maxFiles={1}
				maxSize={1024 * 1024 * 10}
				minSize={1024}
				onDrop={handleDrop}
				onError={handleError}
				src={audioFile ? [audioFile] : undefined}
			>
				<DropzoneEmptyState />
				<DropzoneContent />
			</Dropzone>
			{audioFile && (
				<Card className="w-full">
					<CardHeader>
						<CardTitle>
							Audio{"  "}
							<span className=" text-gray-500 font-medium">
								({audioFile.name})
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="w-full">
						<div className="relative">
							<VoiceVisualizer
								width="100%"
								controls={recorderControls}
								height={100}
								isControlPanelShown={false}
							/>
							{/* Waveform overlay for extremist segments */}
							{duration > 0 && (
								<div className="absolute inset-0 pointer-events-none">
									{segments.map((seg, index) => {
										const startPercent =
											(seg.startTime / duration) * 100;
										const widthPercent =
											((seg.endTime - seg.startTime) /
												duration) *
											100;
										return (
											<WaveformSegmentOverlay
												key={index}
												startTime={seg.startTime}
												endTime={seg.endTime}
												text={seg.segment}
												isExtremist={
													seg.isExtremist || false
												}
												startPercent={startPercent}
												widthPercent={widthPercent}
												onSeek={() =>
													handleSeekToTime(
														seg.startTime
													)
												}
											/>
										);
									})}
								</div>
							)}
						</div>
						<div className="flex justify-center mt-4">
							{!recorderControls.isPausedRecordedAudio ? (
								<Button
									variant="outline"
									onClick={() =>
										recorderControls.stopAudioPlayback()
									}
								>
									<Pause className="size-4" /> Pause
								</Button>
							) : (
								<Button
									variant="outline"
									onClick={() =>
										recorderControls.startAudioPlayback()
									}
								>
									<Play className="size-4" /> Play
								</Button>
							)}
						</div>
						<div className="flex flex-col gap-2 mt-6 max-h-[250px] overflow-y-auto">
							{segments.map((seg, index) => (
								<div
									key={index}
									ref={(el) => {
										segmentRefs.current[index] = el;
									}}
								>
									<AudioSegment
										isActive={isSegmentActive(
											seg.startTime,
											seg.endTime
										)}
										startTime={seg.startTime}
										endTime={seg.endTime}
										segment={seg.segment}
										isExtremist={seg.isExtremist}
										onSeek={() =>
											handleSeekToTime(seg.startTime)
										}
									/>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
			{audioFile && (
				<div className="flex flex-col items-center gap-4">
					{/* Status indicator */}
					{transcriptionStatus === "processing" && (
						<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
							<div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
							<span>Transcribing audio...</span>
						</div>
					)}
					{transcriptionStatus === "error" && (
						<div className="text-red-600 dark:text-red-400">
							❌ Transcription failed
						</div>
					)}

					<div className="flex justify-center gap-2">
						<Button
							variant="gradient"
							disabled={transcriptionStatus !== "complete"}
						>
							<Sparkles className="size-4" /> Start Analysis
						</Button>
						<Button
							variant="outline"
							disabled={transcriptionStatus !== "complete"}
						>
							<Download className="size-4" /> Export Data (.json)
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
