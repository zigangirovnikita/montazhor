#!/usr/bin/env python3
import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Detect main-speaker speech ranges with pyannote diarization.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--hf-token")
    parser.add_argument("--model", default="pyannote/speaker-diarization-3.1")
    parser.add_argument("--min-speakers", type=int)
    parser.add_argument("--max-speakers", type=int)
    args = parser.parse_args()

    token = args.hf_token or os.getenv("PYANNOTE_AUTH_TOKEN") or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
    if not token:
        print(json.dumps({
            "error": "pyannote diarization requires PYANNOTE_AUTH_TOKEN or HUGGINGFACE_TOKEN."
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    try:
        import torch
        from pyannote.audio import Pipeline
        patch_torch_checkpoint_loading(torch)
    except Exception as exc:
        print(json.dumps({
            "error": f"pyannote.audio is not installed or cannot be imported: {exc}"
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    try:
        pipeline = Pipeline.from_pretrained(args.model, use_auth_token=token)
        if torch.cuda.is_available():
            pipeline.to(torch.device("cuda"))

        kwargs = {}
        if args.min_speakers is not None:
            kwargs["min_speakers"] = args.min_speakers
        if args.max_speakers is not None:
            kwargs["max_speakers"] = args.max_speakers

        diarization = pipeline(args.audio, **kwargs)
        speaker_ranges = []
        durations = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            item = {"start": float(turn.start), "end": float(turn.end), "speaker": str(speaker)}
            speaker_ranges.append(item)
            durations[item["speaker"]] = durations.get(item["speaker"], 0.0) + max(0.0, item["end"] - item["start"])

        main_speaker_id = max(durations.items(), key=lambda item: item[1])[0] if durations else None
        speech_ranges = [
            {"start": item["start"], "end": item["end"]}
            for item in speaker_ranges
            if item["speaker"] == main_speaker_id
        ]

        print(json.dumps({
            "provider": "pyannote-diarization",
            "mainSpeakerId": main_speaker_id,
            "speechRanges": speech_ranges,
            "speakerRanges": speaker_ranges,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": f"pyannote diarization failed: {exc}"}, ensure_ascii=False), file=sys.stderr)
        return 1


def patch_torch_checkpoint_loading(torch_module):
    try:
        original_load = torch_module.load

        def load_with_legacy_checkpoint_support(*args, **kwargs):
            kwargs["weights_only"] = False
            return original_load(*args, **kwargs)

        torch_module.load = load_with_legacy_checkpoint_support
    except Exception:
        pass


if __name__ == "__main__":
    raise SystemExit(main())
