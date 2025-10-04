import { cn } from "@/lib/utils";
import React from "react";

import { IoIosWarning } from "react-icons/io";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const formatTime = (seconds: number): string => {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs
		.toString()
		.padStart(2, "0")}`;
};

const AudioSegment = ({
	startTime,
	endTime,
	segment,
	isActive,
	isExtremist,
	onSeek,
}: {
	startTime: number;
	endTime: number;
	segment: string;
	isActive: boolean;
	isExtremist?: boolean;
	onSeek?: () => void;
}) => {
	return (
		<div
			className={cn(
				"flex gap-4 w-full justify-center items-start transition-all max-w-[85%] mx-auto px-4",
				onSeek && "cursor-pointer hover:bg-gray-800/50 rounded-md py-2"
			)}
			onClick={onSeek}
		>
			<p
				className={cn(
					"text-gray-500 whitespace-nowrap",
					isActive && "text-blue-500"
				)}
			>
				{formatTime(startTime)} <span className="text-gray-600">-</span>{" "}
				{formatTime(endTime)}
			</p>
			<div
				className={cn(
					"text-gray-500 flex items-center gap-3 shrink",
					isActive && !isExtremist && "text-white",
					isActive && isExtremist && "text-red-200",
					!isActive && isExtremist && "text-red-200/50"
				)}
			>
				{segment}
			</div>

			{isExtremist && (
				<div className="pt-2">
					<Tooltip>
						<TooltipTrigger>
							<IoIosWarning
								size={16}
								className={cn(
									"min-w-[50px]",
									isActive && "text-red-400",
									!isActive && "text-red-300/50"
								)}
							/>
						</TooltipTrigger>
						<TooltipContent>
							<p>Extremist content detected</p>
						</TooltipContent>
					</Tooltip>
				</div>
			)}
		</div>
	);
};

export default AudioSegment;
