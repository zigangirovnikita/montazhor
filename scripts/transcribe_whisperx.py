#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Set NLTK_DATA early, before any library (speechbrain, pyannote) imports nltk
# and tries to create ~/nltk_data which may be blocked by macOS permissions.
if "NLTK_DATA" in os.environ:
    # Ensure the directory exists so nltk doesn't fall back to ~/nltk_data
    os.makedirs(os.environ["NLTK_DATA"], exist_ok=True)

# Force tqdm and other progress output to stderr so stdout stays clean for JSON.
os.environ["TQDM_POSITION"] = "-1"
os.environ.setdefault("TQDM_DISABLE", "0")

# Redirect tqdm to stderr
try:
    import tqdm
    tqdm.tqdm.__init__.__defaults__ = tuple(
        sys.stderr if isinstance(d, type(sys.stdout)) else d
        for d in tqdm.tqdm.__init__.__defaults__ or ()
    )
except Exception:
    pass


def main():
    parser = argparse.ArgumentParser(description="Transcribe and align speech with WhisperX.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language")
    parser.add_argument("--initial-prompt")
    parser.add_argument("--download-root")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--diarize", default="true", choices=["true", "false"])
    parser.add_argument("--hf-token")
    parser.add_argument("--min-speakers", type=int)
    parser.add_argument("--max-speakers", type=int)
    args = parser.parse_args()

    try:
        import whisperx
        patch_torch_checkpoint_loading()
    except Exception as exc:
        print(
            json.dumps({
                "error": (
                    "whisperx is not installed. Install project Python dependencies "
                    "from requirements.txt before running analysis."
                ),
                "details": str(exc),
            }, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2

    try:
        audio = whisperx.load_audio(args.audio)
        asr_options = {}
        if args.initial_prompt:
            asr_options["initial_prompt"] = args.initial_prompt

        model = whisperx.load_model(
            args.model,
            args.device,
            compute_type=args.compute_type,
            download_root=args.download_root,
            language=args.language,
            asr_options=asr_options if asr_options else None,
        )
        result = model.transcribe(
            audio,
            batch_size=args.batch_size,
            language=args.language,
        )

        language = result.get("language") or args.language or "unknown"
        align_model, metadata = whisperx.load_align_model(language_code=language, device=args.device)
        aligned = whisperx.align(
            result["segments"],
            align_model,
            metadata,
            audio,
            args.device,
            return_char_alignments=False,
        )

        speaker_ranges = []
        main_speaker_id = None
        diarization_provider = None
        if args.diarize == "true":
            token = args.hf_token or os.getenv("PYANNOTE_AUTH_TOKEN") or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
            if not token:
                raise RuntimeError(
                    "pyannote diarization requires PYANNOTE_AUTH_TOKEN or HUGGINGFACE_TOKEN. "
                    "Create a Hugging Face token and accept pyannote model terms."
                )

            from whisperx.diarize import DiarizationPipeline
            diarize_model = DiarizationPipeline(use_auth_token=token, device=args.device)
            diarize_kwargs = {}
            if args.min_speakers is not None:
                diarize_kwargs["min_speakers"] = args.min_speakers
            if args.max_speakers is not None:
                diarize_kwargs["max_speakers"] = args.max_speakers

            diarize_segments = diarize_model(audio, **diarize_kwargs)
            aligned = whisperx.assign_word_speakers(diarize_segments, aligned)
            speaker_ranges = dataframe_to_speaker_ranges(diarize_segments)
            main_speaker_id = choose_main_speaker(aligned, speaker_ranges)
            diarization_provider = "pyannote"

        print(json.dumps(
            to_transcript_json(
                aligned,
                language,
                speaker_ranges,
                main_speaker_id,
                diarization_provider,
            ),
            ensure_ascii=False,
        ))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"WhisperX transcription failed: {exc}"}, ensure_ascii=False), file=sys.stderr)
        return 1


def dataframe_to_speaker_ranges(diarize_segments):
    ranges = []
    try:
        records = diarize_segments.itertracks(yield_label=True)
        for turn, _, speaker in records:
            ranges.append({"start": float(turn.start), "end": float(turn.end), "speaker": str(speaker)})
        return ranges
    except Exception:
        pass

    try:
        for row in diarize_segments.itertuples():
            ranges.append({"start": float(row.start), "end": float(row.end), "speaker": str(row.speaker)})
    except Exception:
        return []
    return ranges


def choose_main_speaker(aligned, speaker_ranges):
    durations = {}
    for segment in aligned.get("segments", []):
        for word in segment.get("words", []) or []:
            speaker = word.get("speaker")
            start = word.get("start")
            end = word.get("end")
            if speaker is None or start is None or end is None:
                continue
            durations[speaker] = durations.get(speaker, 0.0) + max(0.0, float(end) - float(start))

    if not durations:
        for item in speaker_ranges:
            speaker = item["speaker"]
            durations[speaker] = durations.get(speaker, 0.0) + max(0.0, item["end"] - item["start"])

    if not durations:
        return None
    return max(durations.items(), key=lambda item: item[1])[0]


def to_transcript_json(aligned, language, speaker_ranges, main_speaker_id, diarization_provider):
    output_segments = []
    for index, segment in enumerate(aligned.get("segments", [])):
        words = []
        for word in segment.get("words", []) or []:
            if "start" not in word or "end" not in word:
                continue
            item = {
                "word": str(word.get("word", "")).strip(),
                "start": float(word["start"]),
                "end": float(word["end"]),
            }
            if word.get("speaker") is not None:
                item["speaker"] = str(word["speaker"])
            if word.get("score") is not None:
                item["confidence"] = float(word["score"])
            words.append(item)

        if words:
            start = words[0]["start"]
            end = words[-1]["end"]
        else:
            start = float(segment.get("start", 0.0))
            end = float(segment.get("end", start))

        output_segments.append({
            "id": index,
            "start": start,
            "end": end,
            "text": str(segment.get("text", "")).strip(),
            "speaker": dominant_speaker(words),
            "words": words,
        })

    return {
        "language": language,
        "provider": "whisperx",
        "alignmentProvider": "whisperx",
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
