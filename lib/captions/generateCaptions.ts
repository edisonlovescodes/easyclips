import { useEditorStore } from "@/lib/stores/editorStore";

type CaptionChunk = {
	text: string;
	timestamp?: [number, number];
};

type WhisperResult = {
	text: string;
	chunks?: CaptionChunk[];
};

let pipelineInstance:
	| ((
			file: File,
			options: { chunk_length_s: number; stride_length_s: number; return_timestamps: boolean }
		) => Promise<WhisperResult>)
	| null = null;

const createId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
};

async function loadPipeline() {
	if (pipelineInstance) return pipelineInstance;

	const transformers = await import("@xenova/transformers");
	const asr = await transformers.pipeline(
		"automatic-speech-recognition",
		"Xenova/whisper-small.en",
		{
			quantized: true,
		},
	);

	pipelineInstance = (file: File, options: { chunk_length_s: number; stride_length_s: number; return_timestamps: boolean }) =>
		asr(file, options);

	return pipelineInstance;
}

const toSeconds = (value: number | string | undefined) => {
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
};

export async function generateCaptionsFromFile(file: File) {
	const { setCaptionStatus } = useEditorStore.getState();

	try {
		setCaptionStatus({
			stage: "loading-model",
			message: "Loading Whisper small (≈100MB) — first run may take a minute.",
		});

		const pipeline = await loadPipeline();

		setCaptionStatus({
			stage: "transcribing",
			message: "Transcribing audio to captions…",
		});

		const result = await pipeline(file, {
			chunk_length_s: 30,
			stride_length_s: 5,
			return_timestamps: true,
		});

		const { addCaption } = useEditorStore.getState();

		const chunks = result.chunks ?? [];

		for (const chunk of chunks) {
			const [start, end] = chunk.timestamp ?? [undefined, undefined];
			const startSeconds = toSeconds(start);
			const endSeconds = toSeconds(end);

			if (
				typeof startSeconds !== "number" ||
				typeof endSeconds !== "number" ||
				!Number.isFinite(startSeconds) ||
				!Number.isFinite(endSeconds)
			) {
				continue;
			}

			const text = chunk.text?.trim();
			if (!text) continue;

			addCaption({
				id: createId(),
				text,
				startTime: startSeconds,
				endTime: endSeconds,
				style: "default",
				position: "bottom",
				color: "#ffffff",
				fontSize: 16,
			});
		}

		setCaptionStatus({
			stage: "success",
			message: "Captions generated from audio.",
		});
	} catch (error) {
		console.error("Whisper captioning failed", error);
		setCaptionStatus({
			stage: "error",
			message: "Caption generation failed. Check console for details.",
		});
		throw error;
	}
}
