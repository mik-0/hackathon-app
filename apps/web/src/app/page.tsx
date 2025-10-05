"use client";
import { useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function Home() {
	const [isUploading, setIsUploading] = useState(false);
	const toastIdRef = useRef<string | number | null>(null);
	const router = useRouter();

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

	const handleDrop = async (files: File[]) => {
		setIsUploading(true);
		const toastId = toast.loading("Uploading file...");
		toastIdRef.current = toastId;

		try {
			const result = await uploadFile(files[0]);

			if (!result.success) {
				toast.error("Upload failed", { id: toastId });
				setIsUploading(false);
				return;
			}

			toast.success("File uploaded! Redirecting...", { id: toastId });

			// Redirect to the dynamic route
			router.push(`/${result.file.id}`);
		} catch (error) {
			toast.error("Something went wrong: " + error, { id: toastId });
			setIsUploading(false);
			console.log(error);
		}
	};

	const handleError = (error: Error) => {
		console.log(error);
		toast.error(`Something went wrong: ${error.message}`);
	};

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
				onDrop={handleDrop}
				onError={handleError}
				disabled={isUploading}
			>
				<DropzoneEmptyState />
				<DropzoneContent />
			</Dropzone>
		</div>
	);
}
