"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	DndContext,
	DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import {
	FiVideo,
	FiMusic,
	FiMessageSquare,
	FiMaximize2,
	FiPlus,
	FiMinus,
	FiBookmark,
} from "react-icons/fi";
import { useEditorStore } from "@/lib/stores/editorStore";
import type { VideoClip } from "@/lib/stores/editorStore";
import { ClipItem } from "./ClipItem";
import { AspectRatioModal } from "../features/AspectRatioModal";

const MIN_TIMELINE_DURATION = 10;
const MAX_TIMELINE_DURATION = 60 * 60 * 2; // 2 hours
const MIN_ZOOM = 2;
const MAX_ZOOM = 240;
const DEFAULT_ZOOM = 24;
const TRACK_MIN_HEIGHT = 64;
const TRACK_MAX_HEIGHT = 260;
const MIN_CLIP_SEGMENT = 0.1;
type TrackKey = "video" | "audio" | "captions";

const getPrimaryInterval = (pixelsPerSecond: number) => {
	if (pixelsPerSecond <= 3) return 600; // 10 min
	if (pixelsPerSecond <= 6) return 300; // 5 min
	if (pixelsPerSecond <= 10) return 180; // 3 min
	if (pixelsPerSecond <= 18) return 120; // 2 min
	if (pixelsPerSecond <= 30) return 60; // 1 min
	if (pixelsPerSecond <= 60) return 30; // 30 sec
	if (pixelsPerSecond <= 120) return 10; // 10 sec
	if (pixelsPerSecond <= 180) return 5; // 5 sec
	if (pixelsPerSecond <= 200) return 2; // 2 sec
	return 1; // 1 sec
};

const getSubInterval = (primaryInterval: number) => {
	if (primaryInterval >= 300) return primaryInterval / 5;
	if (primaryInterval >= 60) return primaryInterval / 6;
	if (primaryInterval >= 10) return primaryInterval / 5;
	if (primaryInterval >= 2) return primaryInterval / 4;
	return primaryInterval / 2;
};

export function Timeline() {
	const timelineRef = useRef<HTMLDivElement>(null);
	const [showAspectRatioModal, setShowAspectRatioModal] = useState(false);
	const [activeTab, setActiveTab] = useState<"video" | "audio" | "captions">(
		"video",
	);
	const [zoom, setZoom] = useState(DEFAULT_ZOOM); // pixels per second
	const [markers, setMarkers] = useState<
		{ id: string; time: number; label: string }[]
	>([]);
	const [trackHeights, setTrackHeights] = useState<Record<TrackKey, number>>({
		video: 128,
		audio: 100,
		captions: 80,
	});

	const {
		videoClips,
		audioTracks,
		captions,
		currentTime,
		setCurrentTime,
		removeVideoClip,
		updateVideoClip,
		removeAudioTrack,
		splitVideoClip,
		selectedClipId,
		setSelectedClip,
	} = useEditorStore();

	const contentDuration = Math.max(
		0,
		videoClips.reduce(
			(max, clip) => Math.max(max, clip.position + (clip.endTime - clip.startTime)),
			0,
		),
		audioTracks.reduce(
			(max, track) => Math.max(max, track.position + track.duration),
			0,
		),
	);

	const projectedDuration = Math.max(
		MIN_TIMELINE_DURATION,
		Math.min(MAX_TIMELINE_DURATION, Math.max(contentDuration, currentTime)),
	);

	const isZoomedOut = zoom <= 20;
	const timelineDuration = isZoomedOut
		? Math.max(projectedDuration, MAX_TIMELINE_DURATION)
		: projectedDuration;

	const pixelsPerSecond = zoom;
	const timelineWidth = timelineDuration * pixelsPerSecond;
	const primaryInterval = getPrimaryInterval(pixelsPerSecond);
	const subInterval = getSubInterval(primaryInterval);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, delta } = event;
		const clipId = active.id as string;
		const clip = videoClips.find((c) => c.id === clipId);

		if (!clip) return;

		const deltaTime = delta.x / pixelsPerSecond;
		const newPosition = Math.max(0, clip.position + deltaTime);

		updateVideoClip(clipId, { position: newPosition });
	};

	const beginTrackResize =
		(track: TrackKey) => (event: React.MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			event.preventDefault();

			const startY = event.clientY;
			const initialHeight = trackHeights[track];

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = moveEvent.clientY - startY;
				const nextHeight = Math.max(
					TRACK_MIN_HEIGHT,
					Math.min(TRACK_MAX_HEIGHT, initialHeight + delta),
				);
				setTrackHeights((prev) =>
					prev[track] === nextHeight ? prev : { ...prev, [track]: nextHeight },
				);
			};

			const handleMouseUp = () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		};

	const clampTime = (pixels: number) =>
		Math.max(
			0,
			Math.min(
				pixels / pixelsPerSecond,
				isZoomedOut ? MAX_TIMELINE_DURATION : timelineDuration,
			),
		);

	const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (
			event.target !== event.currentTarget &&
			!(event.target as HTMLElement).classList.contains("timeline-clickable")
		) {
			return;
		}

		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left + (event.currentTarget.scrollLeft || 0);
		setCurrentTime(clampTime(x));
		setSelectedClip(null);
	};

	const handlePlayheadDrag = (event: React.MouseEvent<HTMLDivElement>) => {
		const timeline = timelineRef.current;
		if (!timeline) return;

		const rect = timeline.getBoundingClientRect();
		const initialX = event.clientX - rect.left + timeline.scrollLeft;
		setCurrentTime(clampTime(initialX));

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const x = moveEvent.clientX - rect.left + timeline.scrollLeft;
			setCurrentTime(clampTime(x));
		};

		const handleMouseUp = () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

	const addMarker = () => {
		const newMarker = {
			id: crypto.randomUUID(),
			time: currentTime,
			label: `Marker ${markers.length + 1}`,
		};
		setMarkers((prev) => [...prev, newMarker]);
	};

	const clampZoom = (value: number) =>
		Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

	const getZoomStep = (value: number) => {
		if (value >= 120) return 30;
		if (value >= 80) return 20;
		if (value >= 30) return 10;
		if (value >= 12) return 4;
		return 2;
	};

	const adjustZoom = useCallback(
		(direction: "in" | "out") => {
			const timeline = timelineRef.current;

			setZoom((prev) => {
				const step = getZoomStep(prev);
				const delta = direction === "in" ? step : -step;
				const next = clampZoom(prev + delta);

				if (timeline) {
					const nextIsZoomedOut = next <= 20;
					const nextTimelineDuration = nextIsZoomedOut
						? Math.max(projectedDuration, MAX_TIMELINE_DURATION)
						: projectedDuration;
					const targetScroll =
						currentTime * next - timeline.clientWidth / 2;
					const maxScroll = Math.max(
						0,
						nextTimelineDuration * next - timeline.clientWidth,
					);
					const clampedScroll = Math.max(
						0,
						Math.min(targetScroll, maxScroll),
					);
					requestAnimationFrame(() => {
						timeline.scrollLeft = clampedScroll;
					});
				}

				return next;
			});
		},
		[currentTime, projectedDuration],
	);

	const zoomIn = () => adjustZoom("in");
	const zoomOut = () => adjustZoom("out");

	const handleTrimClip = (clipId: string, updates: Partial<VideoClip>) => {
		updateVideoClip(clipId, updates);
		setSelectedClip(clipId);
	};

	const handleSplitClip = (clip: VideoClip) => {
		const clipStart = clip.position;
		const clipEnd = clip.position + (clip.endTime - clip.startTime);
		if (
			currentTime <= clipStart + MIN_CLIP_SEGMENT ||
			currentTime >= clipEnd - MIN_CLIP_SEGMENT
		) {
			return;
		}
		splitVideoClip(clip.id, currentTime);
	};

	const canSplitClip = (clip: VideoClip) => {
		const clipStart = clip.position;
		const clipEnd = clip.position + (clip.endTime - clip.startTime);
		return (
			currentTime > clipStart + MIN_CLIP_SEGMENT &&
			currentTime < clipEnd - MIN_CLIP_SEGMENT
		);
	};

	const removeSelectedClip = useCallback(() => {
		if (!selectedClipId) return;
		removeVideoClip(selectedClipId);
		setSelectedClip(null);
	}, [removeVideoClip, selectedClipId, setSelectedClip]);

	const handleGlobalKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}

			if (event.key === "Delete" || event.key === "Backspace") {
				if (selectedClipId) {
					event.preventDefault();
					removeSelectedClip();
				}
			}

			if (event.key === "+" || event.key === "=") {
				event.preventDefault();
				adjustZoom("in");
			}

			if (event.key === "-") {
				event.preventDefault();
				adjustZoom("out");
			}
		},
		[adjustZoom, removeSelectedClip, selectedClipId],
	);

	useEffect(() => {
		const listener = (event: KeyboardEvent) => handleGlobalKeyDown(event);
		document.addEventListener("keydown", listener);
		return () => {
			document.removeEventListener("keydown", listener);
		};
	}, [handleGlobalKeyDown]);

	const generateTimeMarkers = () => {
		const ticks: number[] = [];
		const total = Math.ceil(timelineDuration / primaryInterval);

		for (let i = 0; i <= total; i += 1) {
			const time = Number((i * primaryInterval).toFixed(4));
			ticks.push(time);
		}

		return ticks;
	};

	const generateSubTicks = () => {
		if (!subInterval) return [];
		const ticks: number[] = [];
		const total = Math.ceil(timelineDuration / subInterval);

		for (let i = 0; i <= total; i += 1) {
			const time = Number((i * subInterval).toFixed(4));
			if (Number.isInteger(time / primaryInterval)) continue;
			ticks.push(time);
		}

		return ticks;
	};

	const formatTimestamp = (seconds: number) => {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		const frames = Math.floor((seconds % 1) * 30); // assume 30fps

		const hh = hrs > 0 ? `${hrs.toString().padStart(2, "0")}:` : "";

		return `${hh}${mins.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
	};

	return (
		<div className="h-full bg-cream flex flex-col">
			{/* Timeline Header */}
			<div className="px-4 py-2 border-b border-dark/10 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<button
						onClick={() => setActiveTab("video")}
						className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
							activeTab === "video"
								? "bg-accent text-white"
								: "text-dark/60 hover:bg-dark/5"
						}`}
					>
						<FiVideo size={14} />
						<span>Video</span>
					</button>
					<button
						onClick={() => setActiveTab("audio")}
						className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
							activeTab === "audio"
								? "bg-accent text-white"
								: "text-dark/60 hover:bg-dark/5"
						}`}
					>
						<FiMusic size={14} />
						<span>Audio</span>
					</button>
					<button
						onClick={() => setActiveTab("captions")}
						className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
							activeTab === "captions"
								? "bg-accent text-white"
								: "text-dark/60 hover:bg-dark/5"
						}`}
					>
						<FiMessageSquare size={14} />
						<span>Captions</span>
					</button>

					<div className="h-6 w-px bg-dark/10 mx-2" />

					<button
						onClick={addMarker}
						className="px-3 py-1.5 text-sm text-dark/60 hover:bg-dark/5 rounded-md transition-colors flex items-center gap-2"
						title="Add Marker"
					>
						<FiBookmark size={14} />
						<span>Markers ({markers.length})</span>
					</button>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 px-3 py-1.5 bg-dark/5 rounded-md">
						<button
							onClick={zoomOut}
							className="p-1 hover:bg-dark/10 rounded transition-colors"
							title="Zoom Out"
						>
							<FiMinus size={14} />
						</button>
						<div className="text-xs text-dark font-mono w-24 text-center bg-cream border border-dark/10 rounded px-2 py-0.5 shadow-sm">
							1s ≈ {zoom}px
						</div>
						<button
							onClick={zoomIn}
							className="p-1 hover:bg-dark/10 rounded transition-colors"
							title="Zoom In"
						>
							<FiPlus size={14} />
						</button>
					</div>

					<button
						onClick={() => setShowAspectRatioModal(true)}
						className="p-2 hover:bg-dark/5 rounded transition-colors"
						title="Aspect Ratio"
					>
						<FiMaximize2 size={16} />
					</button>
				</div>
			</div>

			{showAspectRatioModal && (
				<AspectRatioModal
					isOpen={showAspectRatioModal}
					onClose={() => setShowAspectRatioModal(false)}
				/>
			)}

			{/* Timeline Ruler and Tracks */}
			<div
				ref={timelineRef}
				className="flex-1 overflow-x-auto overflow-y-auto"
			>
				<div
					className="relative min-w-full"
					style={{ width: `${timelineWidth}px` }}
				>
					{/* Time Ruler */}
					<div
						className="h-10 bg-white border-b border-dark/15 relative timeline-clickable shadow-inner"
						onClick={handleTimelineClick}
					>
						{generateTimeMarkers().map((time) => (
							<div
								key={time}
								className="absolute top-0 h-full flex flex-col justify-between pointer-events-none"
								style={{ left: `${time * pixelsPerSecond}px` }}
							>
								<div className="text-[10px] text-dark font-mono px-1.5 py-0.5 bg-cream border border-dark/10 rounded shadow-sm">
									{formatTimestamp(time)}
								</div>
								<div className="h-2 border-l border-dark/20" />
							</div>
						))}

						{zoom > 40 &&
							generateSubTicks().map((time) => (
								<div
									key={`sub-${time}`}
									className="absolute top-0 bottom-0 border-l border-dark/10 pointer-events-none"
									style={{ left: `${time * pixelsPerSecond}px` }}
								/>
							))}
					</div>

					{/* Playhead */}
					<div
							className="absolute top-0 bottom-0 w-0.5 bg-accent z-30 cursor-ew-resize"
							style={{
								left: `${currentTime * pixelsPerSecond}px`,
							}}
							onMouseDown={handlePlayheadDrag}
						>
							<div className="absolute -top-1 -left-2 w-4 h-4 bg-accent border border-white rounded-full pointer-events-none shadow-sm" />
							<div className="absolute top-10 -translate-x-1/2 left-1/2 text-xs bg-dark text-cream px-2 py-0.5 rounded font-mono whitespace-nowrap shadow">
								{formatTimestamp(currentTime)}
							</div>
						</div>

					{/* Markers */}
					{markers.map((marker) => (
						<div
							key={marker.id}
							className="absolute top-10 bottom-0 border-l-2 border-accent z-20 pointer-events-none"
							style={{ left: `${marker.time * pixelsPerSecond}px` }}
						>
							<div className="absolute -top-12 -translate-x-1/2 left-1/2 bg-dark text-cream text-xs px-2 py-0.5 rounded-lg whitespace-nowrap shadow-md border border-accent/40">
								{marker.label}
							</div>
						</div>
					))}

					{/* Video Track */}
					{(activeTab === "video" || activeTab === "captions") && (
						<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
							<div
								className="bg-white border-b border-dark/10 relative timeline-clickable rounded-t-lg"
								style={{ height: `${trackHeights.video}px` }}
								onClick={handleTimelineClick}
							>
								<div className="absolute left-2 top-2 text-xs text-dark/60 font-medium flex items-center gap-1 z-20 bg-cream px-2 py-1 rounded">
									<FiVideo size={12} />
									<span>Video Track</span>
								</div>

								<SortableContext items={videoClips.map((c) => c.id)}>
									{videoClips.map((clip) => (
										<ClipItem
											key={clip.id}
											clip={clip}
											pixelsPerSecond={pixelsPerSecond}
											onDelete={() => removeVideoClip(clip.id)}
											onTrim={handleTrimClip}
											onSplit={() => handleSplitClip(clip)}
											canSplit={canSplitClip(clip)}
											isSelected={selectedClipId === clip.id}
											onSelect={setSelectedClip}
										/>
									))}
								</SortableContext>

								<div
									onMouseDown={beginTrackResize("video")}
									className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-accent/0 hover:bg-accent/20 transition-colors"
								/>
							</div>
						</DndContext>
					)}

					{/* Audio Track */}
					{(activeTab === "audio" || activeTab === "video") && (
						<div
							className="bg-white border-b border-dark/10 relative timeline-clickable"
							style={{ height: `${trackHeights.audio}px` }}
							onClick={handleTimelineClick}
						>
							<div className="absolute left-2 top-2 text-xs text-dark/60 font-medium flex items-center gap-1 z-20 bg-cream px-2 py-1 rounded">
								<FiMusic size={12} />
								<span>Audio Track</span>
							</div>

							{audioTracks.map((track) => (
								<div
									key={track.id}
									className="absolute top-8 h-10 bg-blue-500 rounded-md border border-blue-600 overflow-hidden cursor-move z-10 group"
									style={{
										left: `${track.position * pixelsPerSecond}px`,
										width: `${track.duration * pixelsPerSecond}px`,
									}}
								>
									<div className="px-2 py-1 text-white text-xs truncate flex items-center justify-between h-full">
										<span className="truncate flex-1">{track.file.name}</span>
										<button
											onClick={(event) => {
												event.stopPropagation();
												removeAudioTrack(track.id);
											}}
											className="ml-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-shrink-0"
										>
											×
										</button>
									</div>
								</div>
							))}

							<div
								onMouseDown={beginTrackResize("audio")}
								className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-accent/0 hover:bg-accent/20 transition-colors"
							/>
						</div>
					)}

					{/* Captions Track */}
					{activeTab === "captions" && (
						<div
							className="bg-white border-b border-dark/10 relative timeline-clickable rounded-b-lg"
							style={{ height: `${trackHeights.captions}px` }}
							onClick={handleTimelineClick}
						>
							<div className="absolute left-2 top-2 text-xs text-dark/60 font-medium flex items-center gap-1 z-20 bg-cream px-2 py-1 rounded">
								<FiMessageSquare size={12} />
								<span>Captions Track</span>
							</div>

							{captions.map((caption) => (
								<div
									key={caption.id}
									className="absolute top-8 h-6 bg-purple-500 rounded border border-purple-600 overflow-hidden cursor-pointer z-10"
									style={{
										left: `${caption.startTime * pixelsPerSecond}px`,
										width: `${(caption.endTime - caption.startTime) * pixelsPerSecond}px`,
									}}
								>
									<div className="px-2 text-white text-[10px] truncate">
										{caption.text}
									</div>
								</div>
							))}

							<div
								onMouseDown={beginTrackResize("captions")}
								className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-accent/0 hover:bg-accent/20 transition-colors"
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
