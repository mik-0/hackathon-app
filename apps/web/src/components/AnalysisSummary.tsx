import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
	AlertTriangle,
	MessageSquareWarning,
	CheckCircle2,
	FileAudio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisSummaryProps {
	totalSegments: number;
	extremistCount: number;
	badLanguageCount: number;
	cleanCount: number;
}

const AnalysisSummary = ({
	totalSegments,
	extremistCount,
	badLanguageCount,
	cleanCount,
}: AnalysisSummaryProps) => {
	const extremistPercentage =
		totalSegments > 0
			? ((extremistCount / totalSegments) * 100).toFixed(1)
			: "0";
	const badLanguagePercentage =
		totalSegments > 0
			? ((badLanguageCount / totalSegments) * 100).toFixed(1)
			: "0";
	const cleanPercentage =
		totalSegments > 0
			? ((cleanCount / totalSegments) * 100).toFixed(1)
			: "0";

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<FileAudio className="size-5" />
					Analysis Summary
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{/* Total Segments */}
					<div className="flex flex-col items-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
						<div className="text-3xl font-bold text-blue-400">
							{totalSegments}
						</div>
						<div className="text-sm text-gray-400 mt-1">
							Total Segments
						</div>
					</div>

					{/* Clean Segments */}
					<div className="flex flex-col items-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-5 text-green-400" />
							<div className="text-3xl font-bold text-green-400">
								{cleanCount}
							</div>
						</div>
						<div className="text-sm text-gray-400 mt-1">
							Clean ({cleanPercentage}%)
						</div>
					</div>

					{/* Extremist Speech */}
					<div className="flex flex-col items-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
						<div className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-red-400" />
							<div className="text-3xl font-bold text-red-400">
								{extremistCount}
							</div>
						</div>
						<div className="text-sm text-gray-400 mt-1">
							Extremist ({extremistPercentage}%)
						</div>
					</div>

					{/* Bad Language */}
					<div className="flex flex-col items-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
						<div className="flex items-center gap-2">
							<MessageSquareWarning className="size-5 text-orange-400" />
							<div className="text-3xl font-bold text-orange-400">
								{badLanguageCount}
							</div>
						</div>
						<div className="text-sm text-gray-400 mt-1">
							Bad Language ({badLanguagePercentage}%)
						</div>
					</div>
				</div>

				{/* Risk Level Indicator */}
				<div
					className="mt-6 p-4 rounded-lg border"
					style={{
						backgroundColor:
							extremistCount > 0
								? "rgba(239, 68, 68, 0.1)"
								: badLanguageCount > 0
								? "rgba(249, 115, 22, 0.1)"
								: "rgba(34, 197, 94, 0.1)",
						borderColor:
							extremistCount > 0
								? "rgba(239, 68, 68, 0.2)"
								: badLanguageCount > 0
								? "rgba(249, 115, 22, 0.2)"
								: "rgba(34, 197, 94, 0.2)",
					}}
				>
					<div className="flex items-center justify-between">
						<div>
							<div
								className={cn(
									"text-lg font-semibold",
									extremistCount > 0 && "text-red-400",
									badLanguageCount > 0 &&
										extremistCount === 0 &&
										"text-orange-400",
									extremistCount === 0 &&
										badLanguageCount === 0 &&
										"text-green-400"
								)}
							>
								{extremistCount > 0
									? "High Risk"
									: badLanguageCount > 0
									? "Medium Risk"
									: "Low Risk"}
							</div>
							<div className="text-sm text-gray-400 mt-1">
								{extremistCount > 0
									? "Extremist content detected - immediate review recommended"
									: badLanguageCount > 0
									? "Inappropriate language detected"
									: "No concerning content detected"}
							</div>
						</div>
						<div
							className={cn(
								"size-12 rounded-full flex items-center justify-center",
								extremistCount > 0 && "bg-red-500/20",
								badLanguageCount > 0 &&
									extremistCount === 0 &&
									"bg-orange-500/20",
								extremistCount === 0 &&
									badLanguageCount === 0 &&
									"bg-green-500/20"
							)}
						>
							{extremistCount > 0 ? (
								<AlertTriangle className="size-6 text-red-400" />
							) : badLanguageCount > 0 ? (
								<MessageSquareWarning className="size-6 text-orange-400" />
							) : (
								<CheckCircle2 className="size-6 text-green-400" />
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default AnalysisSummary;
