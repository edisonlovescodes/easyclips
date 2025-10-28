"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiX, FiScissors } from "react-icons/fi";
import type { VideoClip } from "@/lib/stores/editorStore";

interface ClipItemProps {
	clip: VideoClip;
	pixelsPerSecond: number;
	onDelete: () => void;
	onTrim: (clipId: string, updates: Partial<VideoClip>) => void;
	onSplit: () => void;
	canSplit: boolean;
}

const MIN_CLIP_DURATION = 0.1;

export function ClipItem({
	clip,
	pixelsPerSecond,
	onDelete,
	onTrim,
	onSplit,
	canSplit,
}: ClipItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: clip.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		left: `${clip.position * pixelsPerSecond}px`,
		width: `${(clip.endTime - clip.startTime) * pixelsPerSecond}px`,
	};

	const handleTrim =
		(edge: "start" | "end") => (event: React.MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			event.preventDefault();

			const startX = event.clientX;
			const initialStart = clip.startTime;
			const initialEnd = clip.endTime;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaPixels = moveEvent.clientX - startX;
				const deltaSeconds = deltaPixels / pixelsPerSecond;

				if (edge === "start") {
					const nextStart = Math.min(
						initialEnd - MIN_CLIP_DURATION,
						Math.max(0, initialStart + deltaSeconds),
					);
					onTrim(clip.id, { startTime: nextStart });
				} else {
					const nextEnd = Math.max(
						initialStart + MIN_CLIP_DURATION,
						Math.min(clip.duration, initialEnd + deltaSeconds),
					);
					onTrim(clip.id, { endTime: nextEnd });
				}
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`absolute top-6 h-10 bg-accent rounded-md border border-accent/50 overflow-hidden group cursor-move select-none ${
				isDragging ? "opacity-50 z-50" : "z-10"
			}`}
			{...attributes}
			{...listeners}
		>
			<div className="px-2 py-1 text-white text-xs truncate flex items-center justify-between h-full gap-2">
				<div className="truncate flex-1">
					<div className="font-semibold text-[11px] leading-tight truncate">
						{clip.file.name}
					</div>
					<div className="text-[10px] text-white/70 leading-tight">
						{(clip.endTime - clip.startTime).toFixed(2)}s
					</div>
				</div>

				{canSplit && (
					<button
						onClick={(event) => {
							event.stopPropagation();
							event.preventDefault();
							onSplit();
						}}
						className="hidden sm:flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] transition-all group-hover:flex"
						title="Split at playhead"
					>
						<FiScissors size={12} />
						<span>Split</span>
					</button>
				)}

				{/* Delete button */}
				<button
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="ml-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-shrink-0"
				>
					<FiX size={14} />
				</button>
			</div>

			{/* Trim handles */}
			<div
				onMouseDown={handleTrim("start")}
				className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/70 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity"
			/>
			<div
				onMouseDown={handleTrim("end")}
				className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/70 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity"
			/>
		</div>
	);
}
