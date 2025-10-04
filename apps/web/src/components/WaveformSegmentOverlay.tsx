import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { IoIosWarning } from "react-icons/io";

const formatTime = (seconds: number): string => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}`;
};

interface WaveformSegmentOverlayProps {
	startTime: number;
	endTime: number;
	text: string;
	isExtremist: boolean;
	startPercent: number;
	widthPercent: number;
	onSeek?: () => void;
}

const WaveformSegmentOverlay = ({
	startTime,
	endTime,
	text,
	isExtremist,
	startPercent,
	widthPercent,
	onSeek,
}: WaveformSegmentOverlayProps) => {
	const [isHovered, setIsHovered] = useState(false);

	if (!isExtremist) return null;

	const handleClick = () => {
		if (onSeek) {
			onSeek();
		}
	};

	return (
		<div
			className="absolute top-0 bottom-0 bg-red-500/20 hover:bg-red-500/30 transition-colors cursor-pointer pointer-events-auto"
			style={{
				left: `${startPercent}%`,
				width: `${widthPercent}%`,
			}}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={handleClick}
		>
			{isHovered && (
				<div
					className="absolute top-full mt-2 z-50 pointer-events-none"
					style={{
						left: "50%",
						transform: "translateX(-50%)",
					}}
				>
					<Card className="w-64 shadow-lg border-red-500/50 bg-gray-900/95 backdrop-blur p-0">
						<CardContent className="p-4 space-y-2">
							<div className="flex items-center gap-2 text-red-400">
								<IoIosWarning className="size-5" />
								<span className="font-semibold text-sm">
									Extremist Content Detected
								</span>
							</div>
							<div className="text-xs text-gray-400">
								<span className="font-mono">
									{formatTime(startTime)} -{" "}
									{formatTime(endTime)}
								</span>
								<span className="mx-2">•</span>
								<span>
									{(endTime - startTime).toFixed(1)}s duration
								</span>
							</div>
							<div className="text-sm text-gray-300 leading-relaxed">
								"{text}"
							</div>
							<div className="pt-2 border-t border-gray-700">
								<div className="flex items-center justify-between text-xs">
									<span className="text-gray-400">
										Confidence
									</span>
									<span className="text-red-400 font-semibold">
										High
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
};

export default WaveformSegmentOverlay;
