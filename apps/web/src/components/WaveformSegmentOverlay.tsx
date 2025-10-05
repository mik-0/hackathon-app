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
	category?: "EXTREMIST_SPEECH" | "BAD_LANGUAGE" | null;
	startPercent: number;
	widthPercent: number;
	onSeek?: () => void;
}

const WaveformSegmentOverlay = ({
	startTime,
	endTime,
	text,
	category,
	startPercent,
	widthPercent,
	onSeek,
}: WaveformSegmentOverlayProps) => {
	const [isHovered, setIsHovered] = useState(false);

	if (!category) return null;

	const isExtremist = category === "EXTREMIST_SPEECH";
	const isBadLanguage = category === "BAD_LANGUAGE";

	const handleClick = () => {
		if (onSeek) {
			onSeek();
		}
	};

	return (
		<div
			className={cn(
				"absolute top-0 bottom-0 transition-colors cursor-pointer pointer-events-auto",
				isExtremist && "bg-red-500/20 hover:bg-red-500/30",
				isBadLanguage && "bg-orange-500/20 hover:bg-orange-500/30"
			)}
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
					<Card
						className={cn(
							"w-64 shadow-lg bg-gray-900/95 backdrop-blur p-0",
							isExtremist && "border-red-500/50",
							isBadLanguage && "border-orange-500/50"
						)}
					>
						<CardContent className="p-4 space-y-2">
							<div
								className={cn(
									"flex items-center gap-2",
									isExtremist && "text-red-400",
									isBadLanguage && "text-orange-400"
								)}
							>
								<IoIosWarning className="size-5" />
								<span className="font-semibold text-sm">
									{isExtremist &&
										"Extremist Content Detected"}
									{isBadLanguage && "Bad Language Detected"}
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
										Category
									</span>
									<span
										className={cn(
											"font-semibold",
											isExtremist && "text-red-400",
											isBadLanguage && "text-orange-400"
										)}
									>
										{category === "EXTREMIST_SPEECH" &&
											"Extremist Speech"}
										{category === "BAD_LANGUAGE" &&
											"Bad Language"}
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
