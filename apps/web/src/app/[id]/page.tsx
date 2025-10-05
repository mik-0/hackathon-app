"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, Pause, Play, Sparkles, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AudioSegment from "@/components/AudioSegment";
import WaveformSegmentOverlay from "@/components/WaveformSegmentOverlay";
import AnalysisSummary from "@/components/AnalysisSummary";
import { useParams, useRouter } from "next/navigation";

export default function MediaFilePage() {
	const params = useParams();
	const router = useRouter();
	const mediaFileId = params.id as string;

	const [segments, setSegments] = useState<
		{
			startTime: number;
			endTime: number;
			segment: string;
			isExtremist: boolean;
			category?: "EXTREMIST_SPEECH" | "BAD_LANGUAGE" | null;
		}[]
	>([]);
	const [audioLoaded, setAudioLoaded] = useState(false);

	const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
	const toastIdRef = useRef<string | number | null>(null);

	const { mutateAsync: processAudio, isPending: isProcessing } = useMutation(
		trpc.processor.processAudio.mutationOptions()
	);

	const recorderControls = useVoiceVisualizer({});
	const currentTime = recorderControls.currentAudioTime;
	const duration = recorderControls.duration;

	// Auto-poll transcription AND processing status
	const { data: fileData, refetch: refetchFile } = useQuery(
		trpc.mediaFiles.getTranscriptionStatus.queryOptions(
			{
				id: mediaFileId,
			},
			{
				enabled: !!mediaFileId,
				refetchInterval: 3000,
			}
		)
	);

	// Load audio file from server when data is available
	useEffect(() => {
		if (fileData && fileData.status === "complete" && !audioLoaded) {
			const serverUrl =
				process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
			const audioUrl = `${serverUrl}/uploads/${mediaFileId}`;

			fetch(audioUrl)
				.then((res) => res.blob())
				.then((blob) => {
					const file = new File([blob], fileData.filename, {
						type: "audio/*",
					});
					recorderControls.setPreloadedAudioBlob(file);
					setAudioLoaded(true);
				})
				.catch((error) => {
					console.error("Failed to load audio:", error);
					toast.error("Failed to load audio file");
				});
		}
	}, [fileData, audioLoaded, mediaFileId, recorderControls]);

	// Handle data changes
	useEffect(() => {
		if (!fileData) return;

		// Update segments when transcript is available
		if (fileData.status === "complete" && fileData.transcript) {
			const transformedSegments = fileData.transcript.segments.map(
				(seg: any) => ({
					startTime: seg.start,
					endTime: seg.end,
					segment: seg.text,
					isExtremist: seg.category === "EXTREMIST_SPEECH",
					category: seg.category || null,
				})
			);

			setSegments(transformedSegments);
		}
	}, [fileData]);

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

	const handleProcessAudio = async () => {
		const toastId = toast.loading("Processing audio...");
		toastIdRef.current = toastId;
		try {
			await processAudio({ mediaId: mediaFileId });
			toast.success("Audio processed successfully", {
				id: toastId,
			});
			refetchFile();
		} catch (error) {
			toast.error("Failed to process audio", {
				id: toastId,
			});
		}
	};

	const handleExportData = () => {
		const exportData = {
			filename: fileData?.filename,
			totalSegments: segments.length,
			extremistCount: segments.filter(
				(s) => s.category === "EXTREMIST_SPEECH"
			).length,
			badLanguageCount: segments.filter(
				(s) => s.category === "BAD_LANGUAGE"
			).length,
			cleanCount: segments.filter((s) => !s.category).length,
			segments: segments.map((seg) => ({
				startTime: seg.startTime,
				endTime: seg.endTime,
				text: seg.segment,
				category: seg.category,
			})),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${fileData?.filename || "export"}_analysis.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	// Calculate summary stats
	const extremistCount = segments.filter(
		(s) => s.category === "EXTREMIST_SPEECH"
	).length;
	const badLanguageCount = segments.filter(
		(s) => s.category === "BAD_LANGUAGE"
	).length;
	const cleanCount = segments.filter((s) => !s.category).length;

	return (
		<div className="container mx-auto max-w-3xl px-4 space-y-8 py-8 flex flex-col items-center">
			<div className="self-start w-full flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => router.push("/")}
				>
					<ArrowLeft className="size-4" />
				</Button>
				<div>
					<h1 className="text-2xl font-bold">
						{fileData?.filename || "Loading..."}
					</h1>
					<p className="text-gray-500">
						{fileData?.status === "processing" && "Transcribing..."}
						{fileData?.status === "complete" &&
							fileData?.processingStatus === "processing" &&
							"Analyzing..."}
						{fileData?.status === "complete" &&
							fileData?.processingStatus === "complete" &&
							"Analysis Complete"}
						{fileData?.status === "complete" &&
							fileData?.processingStatus === "idle" &&
							"Ready for Analysis"}
					</p>
				</div>
			</div>

			{/* Status indicators */}
			{fileData?.status === "processing" && (
				<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
					<div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
					<span>Transcribing audio...</span>
				</div>
			)}

			{fileData?.processingStatus === "processing" && (
				<div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
					<div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
					<span>Analyzing content...</span>
				</div>
			)}

			{/* Summary Card - only show after processing is complete */}
			{fileData?.processingStatus === "complete" &&
				segments.length > 0 && (
					<AnalysisSummary
						totalSegments={segments.length}
						extremistCount={extremistCount}
						badLanguageCount={badLanguageCount}
						cleanCount={cleanCount}
					/>
				)}

			{fileData && audioLoaded && (
				<Card className="w-full">
					<CardHeader>
						<CardTitle>Audio Waveform</CardTitle>
					</CardHeader>
					<CardContent className="w-full">
						<div className="relative">
							<VoiceVisualizer
								width="100%"
								controls={recorderControls}
								height={100}
								isControlPanelShown={false}
							/>
							{/* Waveform overlay for flagged segments */}
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
												category={seg.category}
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
										category={seg.category}
									/>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{fileData && (
				<div className="flex justify-center gap-2">
					<Button
						onClick={handleProcessAudio}
						variant="gradient"
						disabled={
							fileData.status !== "complete" ||
							fileData.processingStatus === "processing" ||
							fileData.processingStatus === "complete"
						}
					>
						<Sparkles className="size-4" />
						{fileData.processingStatus === "complete"
							? "Analysis Complete"
							: "Start Analysis"}
					</Button>
					<Button
						variant="outline"
						disabled={fileData.processingStatus !== "complete"}
						onClick={handleExportData}
					>
						<Download className="size-4" /> Export Data (.json)
					</Button>
				</div>
			)}
		</div>
	);
}
