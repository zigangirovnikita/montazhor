#!/usr/bin/env python3
"""Transcribe audio with stable-ts (faster-whisper backend, DTW word timestamps).

stable-ts uses Dynamic Time Warping on Whisper cross-attention weights
to produce word-level timestamps, which handles skipped filler words
more gracefully than the wav2vec2 forced alignment used by WhisperX.

Diarization is handled via pyannote.audio when --diarize is true.
The output format matches TranscriptJson used by the rest of Montazhor.
"""
import argparse
import json
import os
import sys

# Keep stdout clean for JSON output.
os.environ["TQDM_POSITION"] = "-1"
os.environ.setdefault("TQDM_DISABLE", "0")

try:
    import tqdm
    tqdm.tqdm.__init__.__defaults__ = tuple(
        sys.stderr if isinstance(d, type(sys.stdout)) else d
        for d in tqdm.tqdm.__init__.__defaults__ or ()
    )
except Exception:
    pass


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with stable-ts + faster-whisper (DTW timestamps).")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default=None)
    parser.add_argument("--initial-prompt", default=None)
    parser.add_argument("--download-root", default=None)
    parser.add_argument("--diarize", default="true", choices=["true", "false"])
    parser.add_argument("--hf-token", default=None)
    parser.add_argument("--min-speakers", type=int, default=None)
    parser.add_argument("--max-speakers", type=int, default=None)
    args = parser.parse_args()

    try:
        import stable_whisper
    except Exception as exc:
        print(json.dumps({
            "error": "stable-ts is not installed. Run: pip install stable-ts",
            "details": str(exc),
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    try:
        patch_torch_checkpoint_loading()

        model_kwargs = {}
        if args.download_root:
            model_kwargs["download_root"] = args.download_root

        model = stable_whisper.load_faster_whisper(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            **model_kwargs,
        )

        transcribe_kwargs = {
            "word_timestamps": True,
        }
        if args.language:
            transcribe_kwargs["language"] = args.language
        if args.initial_prompt:
            transcribe_kwargs["initial_prompt"] = args.initial_prompt

        result = model.transcribe(args.audio, **transcribe_kwargs)

        # Run diarization if requested
        speaker_ranges = []
        main_speaker_id = None
        diarization_provider = None

        if args.diarize == "true":
            try:
                speaker_ranges, main_speaker_id = run_pyannote_diarization(
                    args.audio, args.hf_token, args.min_speakers, args.max_speakers
                )
                if main_speaker_id:
                    diarization_provider = "pyannote"
                    assign_speakers_to_result(result, speaker_ranges, main_speaker_id)
            except Exception as exc:
                print(json.dumps({
                    "warning": f"Diarization failed, proceeding without speaker labels: {exc}",
                }, ensure_ascii=False), file=sys.stderr)

        transcript = to_transcript_json(
            result,
            args.language or "unknown",
            speaker_ranges,
            main_speaker_id,
            diarization_provider,
        )
        print(json.dumps(transcript, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "error": f"stable-ts transcription failed: {exc}",
        }, ensure_ascii=False), file=sys.stderr)
        return 1


def run_pyannote_diarization(audio_path, hf_token, min_speakers, max_speakers):
    """Run pyannote diarization and return (speaker_ranges, main_speaker_id)."""
    token = hf_token or os.getenv("PYANNOTE_AUTH_TOKEN") or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError(
            "pyannote diarization requires PYANNOTE_AUTH_TOKEN or HUGGINGFACE_TOKEN. "
            "Create a Hugging Face token and accept pyannote model terms."
        )

    import torch
    from pyannote.audio import Pipeline

    model_name = os.getenv("PYANNOTE_DIARIZATION_MODEL", "pyannote/speaker-diarization-3.1")
    pipeline = Pipeline.from_pretrained(model_name, use_auth_token=token)
    if torch.cuda.is_available():
        pipeline.to(torch.device("cuda"))

    kwargs = {}
    if min_speakers is not None:
        kwargs["min_speakers"] = min_speakers
    if max_speakers is not None:
        kwargs["max_speakers"] = max_speakers

    diarization = pipeline(audio_path, **kwargs)
    speaker_ranges = []
    durations = {}
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        item = {"start": float(turn.start), "end": float(turn.end), "speaker": str(speaker)}
        speaker_ranges.append(item)
        durations[item["speaker"]] = durations.get(item["speaker"], 0.0) + max(0.0, item["end"] - item["start"])

    main_speaker_id = max(durations.items(), key=lambda item: item[1])[0] if durations else None
    return speaker_ranges, main_speaker_id


def assign_speakers_to_result(result, speaker_ranges, main_speaker_id):
    """Assign speaker labels to words in stable-ts result based on pyannote ranges."""
    for segment in result.segments:
        for word in segment.words:
            word_mid = (word.start + word.end) / 2
            best_speaker = None
            best_overlap = 0
            for sr in speaker_ranges:
                overlap_start = max(word.start, sr["start"])
                overlap_end = min(word.end, sr["end"])
                overlap = max(0, overlap_end - overlap_start)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = sr["speaker"]
            # Fall back to midpoint containment if no overlap found
            if best_speaker is None:
                for sr in speaker_ranges:
                    if sr["start"] <= word_mid <= sr["end"]:
                        best_speaker = sr["speaker"]
                        break
            # Attach speaker as custom attribute
            word._speaker = best_speaker


def to_transcript_json(result, language, speaker_ranges, main_speaker_id, diarization_provider):
    """Convert stable-ts result to TranscriptJson matching WhisperX output format."""
    output_segments = []
    for index, segment in enumerate(result.segments):
        words = []
        for word in segment.words:
            item = {
                "word": str(word.word).strip(),
                "start": round(float(word.start), 3),
                "end": round(float(word.end), 3),
            }
            speaker = getattr(word, "_speaker", None)
            if speaker is not None:
                item["speaker"] = speaker
            # stable-ts provides probability per word
            if hasattr(word, "probability") and word.probability is not None:
                item["confidence"] = round(float(word.probability), 3)
            words.append(item)

        if words:
            start = words[0]["start"]
            end = words[-1]["end"]
        else:
            start = round(float(segment.start), 3)
            end = round(float(segment.end), 3)

        output_segments.append({
            "id": index,
            "start": start,
            "end": end,
            "text": str(segment.text).strip(),
            "speaker": dominant_speaker(words),
            "words": words,
        })

    return {
        "language": language,
        "provider": "stable-ts",
        "alignmentProvider": "stable-ts-dtw",
        "diarizationProvider": diarization_provider,
        "mainSpeakerId": main_speaker_id,
        "speakerRanges": speaker_ranges,
        "segments": output_segments,
    }


def dominant_speaker(words):
    durations = {}
    for word in words:
        speaker = word.get("speaker")
        if not speaker:
            continue
        durations[speaker] = durations.get(speaker, 0.0) + max(0.0, word["end"] - word["start"])
    if not durations:
        return None
    return max(durations.items(), key=lambda item: item[1])[0]


def patch_torch_checkpoint_loading():
    try:
        import torch
        original_load = torch.load

        def load_with_legacy_checkpoint_support(*args, **kwargs):
            kwargs["weights_only"] = False
            return original_load(*args, **kwargs)

        torch.load = load_with_legacy_checkpoint_support
    except Exception:
        pass


if __name__ == "__main__":
    raise SystemExit(main())
