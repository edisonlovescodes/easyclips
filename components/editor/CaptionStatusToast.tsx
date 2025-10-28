"use client";

import { useEffect, type ReactNode } from "react";
import { FiLoader, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useEditorStore } from "@/lib/stores/editorStore";

const stageStyles: Record<
	string,
	{
		icon: ReactNode;
		className: string;
	}
> = {
	"loading-model": {
		icon: <FiLoader className="animate-spin" />,
		className: "bg-dark text-cream border border-dark/40",
	},
	transcribing: {
		icon: <FiLoader className="animate-spin" />,
		className: "bg-dark text-cream border border-dark/40",
	},
	success: {
		icon: <FiCheckCircle />,
		className: "bg-emerald-500 text-white border border-emerald-300",
	},
	error: {
		icon: <FiXCircle />,
		className: "bg-red-500 text-white border border-red-300",
	},
};

export function CaptionStatusToast() {
	const captionStatus = useEditorStore((state) => state.captionStatus);
	const setCaptionStatus = useEditorStore((state) => state.setCaptionStatus);

	useEffect(() => {
		if (captionStatus.stage === "success") {
			const timeout = setTimeout(
				() => setCaptionStatus({ stage: "idle" }),
				3500,
			);
			return () => clearTimeout(timeout);
		}

		return undefined;
	}, [captionStatus.stage, setCaptionStatus]);

	if (captionStatus.stage === "idle") {
		return null;
	}

	const { icon, className } =
		stageStyles[captionStatus.stage] ?? stageStyles["loading-model"];

	return (
		<div className="pointer-events-none fixed top-20 right-6 z-50">
			<div
				className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl min-w-[280px] max-w-xs ${className}`}
			>
				<div className="mt-0.5 text-lg">{icon}</div>
				<div className="space-y-1 text-sm leading-snug">
					<div className="font-semibold">
						{captionStatus.stage === "loading-model" && "Loading Whisper"}
						{captionStatus.stage === "transcribing" && "Generating Captions"}
						{captionStatus.stage === "success" && "Captions Ready"}
						{captionStatus.stage === "error" && "Caption Error"}
					</div>
					{captionStatus.message && (
						<p className="text-xs opacity-80">{captionStatus.message}</p>
					)}
				</div>
			</div>
		</div>
	);
}
