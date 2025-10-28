"use client";

import { useState } from "react";
import { Toolbar } from "./Toolbar";
import { Canvas } from "./Canvas";
import { Timeline } from "./Timeline";
import { Footer } from "../ui/Footer";
import { CaptionStatusToast } from "./CaptionStatusToast";

const TIMELINE_MIN_HEIGHT = 200;
const TIMELINE_MAX_HEIGHT = 520;

export function VideoEditor() {
	const [timelineHeight, setTimelineHeight] = useState(300);

	const handleTimelineResize = (event: React.MouseEvent<HTMLDivElement>) => {
		event.preventDefault();
		const startY = event.clientY;
		const startHeight = timelineHeight;

		const handleMove = (moveEvent: MouseEvent) => {
			const delta = startY - moveEvent.clientY;
			const nextHeight = Math.max(
				TIMELINE_MIN_HEIGHT,
				Math.min(TIMELINE_MAX_HEIGHT, startHeight + delta),
			);
			setTimelineHeight(nextHeight);
		};

		const handleUp = () => {
			document.removeEventListener("mousemove", handleMove);
			document.removeEventListener("mouseup", handleUp);
		};

		document.addEventListener("mousemove", handleMove);
		document.addEventListener("mouseup", handleUp);
	};

	return (
		<div className="relative h-full w-full flex flex-col">
			<CaptionStatusToast />

			{/* Header/Toolbar */}
			<Toolbar />

			{/* Main content area with canvas */}
			<div className="flex-1 flex flex-col overflow-hidden bg-dark/5">
				<div className="flex-1 overflow-hidden">
					<Canvas />
				</div>

				<div
					onMouseDown={handleTimelineResize}
					className="h-2 cursor-row-resize bg-transparent hover:bg-accent/30 transition-colors"
					title="Drag to resize timeline"
				/>

				{/* Timeline */}
				<div
					className="border-t border-dark/10 bg-cream flex-shrink-0"
					style={{ height: `${timelineHeight}px` }}
				>
					<Timeline />
				</div>
			</div>

			{/* Footer */}
			<Footer />
		</div>
	);
}
