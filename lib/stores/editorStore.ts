import { create } from "zustand";

const MIN_CLIP_DURATION = 0.1;

const createId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
};

export interface VideoClip {
	id: string;
	file: File;
	url: string;
	duration: number;
	startTime: number;
	endTime: number;
	track: number;
	position: number; // Position in timeline (seconds)
}

export interface AudioTrack {
	id: string;
	file: File;
	url: string;
	duration: number;
	volume: number;
	position: number;
	track: number;
}

export interface Caption {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	style: "default" | "bold" | "minimal";
	position: "top" | "center" | "bottom";
	color: string;
	fontSize: number;
}

export type CaptionStatus =
	| { stage: "idle"; message?: string }
	| { stage: "loading-model"; message?: string }
	| { stage: "transcribing"; message?: string }
	| { stage: "success"; message?: string }
	| { stage: "error"; message: string };

export interface EditorState {
	// Video clips
	videoClips: VideoClip[];
	addVideoClip: (clip: VideoClip) => void;
	removeVideoClip: (id: string) => void;
	updateVideoClip: (id: string, updates: Partial<VideoClip>) => void;
	splitVideoClip: (id: string, splitTime: number) => void;
	selectedClipId: string | null;
	setSelectedClip: (id: string | null) => void;

	// Audio tracks
	audioTracks: AudioTrack[];
	addAudioTrack: (track: AudioTrack) => void;
	removeAudioTrack: (id: string) => void;
	updateAudioTrack: (id: string, updates: Partial<AudioTrack>) => void;

	// Captions
	captions: Caption[];
	addCaption: (caption: Caption) => void;
	removeCaption: (id: string) => void;
	updateCaption: (id: string, updates: Partial<Caption>) => void;

	// Playback
	currentTime: number;
	isPlaying: boolean;
	setCurrentTime: (time: number) => void;
	setIsPlaying: (playing: boolean) => void;

	// Canvas
	canvasWidth: number;
	canvasHeight: number;
	aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "custom";
	setAspectRatio: (ratio: "16:9" | "9:16" | "1:1" | "4:3" | "custom") => void;
	setCanvasDimensions: (width: number, height: number) => void;

	// Export
	isExporting: boolean;
	exportProgress: number;
	setIsExporting: (exporting: boolean) => void;
	setExportProgress: (progress: number) => void;

	// Captions
	captionStatus: CaptionStatus;
	setCaptionStatus: (status: CaptionStatus) => void;

	// Reset
	reset: () => void;
}

const initialState = {
	videoClips: [],
	audioTracks: [],
	captions: [],
	currentTime: 0,
	isPlaying: false,
	canvasWidth: 1920,
	canvasHeight: 1080,
	aspectRatio: "16:9" as const,
	isExporting: false,
	exportProgress: 0,
	selectedClipId: null as string | null,
	captionStatus: { stage: "idle" } as CaptionStatus,
};

export const useEditorStore = create<EditorState>((set) => ({
	...initialState,

	// Video clips
	addVideoClip: (clip) =>
		set((state) => ({
			videoClips: [...state.videoClips, clip].sort(
				(a, b) => a.position - b.position,
			),
			selectedClipId: clip.id,
		})),
	removeVideoClip: (id) =>
		set((state) => ({
			videoClips: state.videoClips.filter((c) => c.id !== id),
			selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
		})),
	updateVideoClip: (id, updates) =>
		set((state) => ({
			videoClips: state.videoClips.map((c) =>
				c.id === id ? { ...c, ...updates } : c
			),
		})),
	splitVideoClip: (id, splitTime) =>
		set((state) => {
			const clipIndex = state.videoClips.findIndex((clip) => clip.id === id);
			if (clipIndex === -1) return state;

			const clip = state.videoClips[clipIndex];
			const relativeSplit = splitTime - clip.position;
			const clipLength = clip.endTime - clip.startTime;

			if (
				relativeSplit <= MIN_CLIP_DURATION ||
				relativeSplit >= clipLength - MIN_CLIP_DURATION
			) {
				return state;
			}

			const newStartTime = clip.startTime + relativeSplit;

			const leftClip: VideoClip = {
				...clip,
				endTime: newStartTime,
			};

			const rightClip: VideoClip = {
				...clip,
				id: createId(),
				startTime: newStartTime,
				position: clip.position + relativeSplit,
			};

			const nextClips = [...state.videoClips];
			nextClips.splice(clipIndex, 1, leftClip, rightClip);

			return {
				videoClips: nextClips,
				selectedClipId: rightClip.id,
			};
		}),
	selectedClipId: null,
	setSelectedClip: (id) => set({ selectedClipId: id }),

	// Audio tracks
	addAudioTrack: (track) =>
		set((state) => ({ audioTracks: [...state.audioTracks, track] })),
	removeAudioTrack: (id) =>
		set((state) => ({
			audioTracks: state.audioTracks.filter((t) => t.id !== id),
		})),
	updateAudioTrack: (id, updates) =>
		set((state) => ({
			audioTracks: state.audioTracks.map((t) =>
				t.id === id ? { ...t, ...updates } : t
			),
		})),

	// Captions
	addCaption: (caption) =>
		set((state) => ({ captions: [...state.captions, caption] })),
	removeCaption: (id) =>
		set((state) => ({
			captions: state.captions.filter((c) => c.id !== id),
		})),
	updateCaption: (id, updates) =>
		set((state) => ({
			captions: state.captions.map((c) =>
				c.id === id ? { ...c, ...updates } : c
			),
		})),

	// Playback
	setCurrentTime: (time) => set({ currentTime: time }),
	setIsPlaying: (playing) => set({ isPlaying: playing }),

	// Canvas
	setAspectRatio: (ratio) => {
		const dimensions: Record<string, { width: number; height: number }> = {
			"16:9": { width: 1920, height: 1080 },
			"9:16": { width: 1080, height: 1920 },
			"1:1": { width: 1080, height: 1080 },
			"4:3": { width: 1440, height: 1080 },
			custom: { width: 1920, height: 1080 },
		};
		set({
			aspectRatio: ratio,
			...dimensions[ratio],
		});
	},
	setCanvasDimensions: (width, height) =>
		set({ canvasWidth: width, canvasHeight: height }),

	// Export
	setIsExporting: (exporting) => set({ isExporting: exporting }),
	setExportProgress: (progress) => set({ exportProgress: progress }),

	// Captions
	captionStatus: { stage: "idle" },
	setCaptionStatus: (status) => set({ captionStatus: status }),

	// Reset
	reset: () => set(initialState),
}));
