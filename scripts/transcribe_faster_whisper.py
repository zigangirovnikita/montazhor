#!/usr/bin/env python3
import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language")
    parser.add_argument("--initial-prompt")
    parser.add_argument("--vad-filter", default="false", choices=["true", "false"])
    parser.add_argument("--download-root")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(
            "faster-whisper is not installed. Run: python3.11 -m venv .venv && . .venv/bin/activate && pip install faster-whisper",
            file=sys.stderr,
        )
        raise exc

    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
        download_root=args.download_root,
    )
    segments, info = model.transcribe(
        args.audio,
        language=args.language,
        initial_prompt=args.initial_prompt,
        word_timestamps=True,
        vad_filter=args.vad_filter == "true",
    )

    output_segments = []
    for index, segment in enumerate(segments):
        words = []
        for word in segment.words or []:
            words.append({"word": word.word.strip(), "start": float(word.start), "end": float(word.end)})
        output_segments.append(
            {
                "id": index,
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
                "words": words,
            }
        )

    print(json.dumps({"language": info.language, "segments": output_segments}, ensure_ascii=False))


if __name__ == "__main__":
    main()
