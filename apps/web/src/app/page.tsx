"use client";
import { useQuery } from "@tanstack/react-query";
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
import { Pause, Play, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AudioSegment from "@/components/AudioSegment";

export default function Home() {
	const healthCheck = useQuery(trpc.healthCheck.queryOptions());

	const [audioFile, setAudioFile] = useState<File | null>(null);
	const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

	const recorderControls = useVoiceVisualizer({});
	const currentTime = recorderControls.currentAudioTime;

	const handleDrop = (files: File[]) => {
		console.log(files);
		setAudioFile(files[0]);
		recorderControls.setPreloadedAudioBlob(files[0]);
		recorderControls.startAudioPlayback();
	};

	const handleError = (error: Error) => {
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

	const segments = [
		{
			startTime: 0,
			endTime: 4,
			segment:
				"Welcome everyone to today's discussion about community safety and security measures.",
			isExtremist: false,
		},
		{
			startTime: 4,
			endTime: 8,
			segment:
				"We need to take immediate action against those who threaten our way of life and values.",
			isExtremist: true,
		},
		{
			startTime: 8,
			endTime: 12,
			segment:
				"Education and dialogue are the best tools we have for building understanding between different groups.",
		},
		{
			startTime: 12,
			endTime: 16,
			segment:
				"They are the enemy and must be stopped by any means necessary before they destroy everything we hold dear.",
			isExtremist: true,
		},
		{
			startTime: 16,
			endTime: 20,
			segment:
				"Let's focus on constructive solutions that bring people together rather than divide them.",
		},
		{
			startTime: 20,
			endTime: 24,
			segment:
				"Thank you for listening and remember to stay engaged in your local community initiatives.",
		},
	];

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
					<CardHeader className="flex justify-between items-center">
						<CardTitle>Audio ({audioFile.name})</CardTitle>
						<div className="flex items-center gap-2">
							{!recorderControls.isPausedRecordedAudio ? (
								<Button
									variant="outline"
									size="icon"
									onClick={() =>
										recorderControls.stopAudioPlayback()
									}
								>
									<Pause className="size-4" />
								</Button>
							) : (
								<Button
									variant="outline"
									size="icon"
									onClick={() =>
										recorderControls.startAudioPlayback()
									}
								>
									<Play className="size-4" />
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent className="w-full">
						<VoiceVisualizer
							width="100%"
							controls={recorderControls}
							height={100}
							isControlPanelShown={false}
						/>
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
			<Button variant="gradient">
				<Sparkles className="size-4" /> Start Analysis
			</Button>
		</div>
	);
}
