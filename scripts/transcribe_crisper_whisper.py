#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with CrisperWhisper in an isolated dependency path.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model-id", default=os.environ.get("CRISPER_MODEL_ID", "nyrahealth/CrisperWhisper"))
    parser.add_argument("--language", default=None)
    parser.add_argument("--initial-prompt", default=None)
    parser.add_argument("--download-root", default=None)
    parser.add_argument("--device", default=None)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--chunk-length", type=int, default=30)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    site_packages = os.environ.get("CRISPER_SITE_PACKAGES")
    if site_packages:
      sys.path.insert(0, site_packages)

    try:
        import torch
        from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
    except Exception as exc:
        print(json.dumps({
            "error": "CrisperWhisper dependencies are not available.",
            "details": str(exc),
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    device = resolve_device(torch, args.device)
    torch_dtype = resolve_dtype(torch, device)

    try:
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            args.model_id,
            torch_dtype=torch_dtype,
            # This model is large enough that the default eager CPU load can
            # double-allocate weights and get OOM-killed on smaller servers.
            low_cpu_mem_usage=True,
            use_safetensors=True,
            cache_dir=args.download_root,
            attn_implementation="eager",
        )
        model.to(device)
        processor = AutoProcessor.from_pretrained(args.model_id, cache_dir=args.download_root)
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            chunk_length_s=args.chunk_length,
            batch_size=args.batch_size,
            return_timestamps="word",
            torch_dtype=torch_dtype,
            device=device,
        )

        result = pipe(args.audio)
        transcript = to_transcript_json(result, args.language or "unknown", args.model_id)
        payload = json.dumps(transcript, ensure_ascii=False)
        if args.output:
            Path(args.output).write_text(payload, encoding="utf-8")
        print(payload)
        return 0
    except Exception as exc:
        print(json.dumps({
            "error": "CrisperWhisper transcription failed.",
            "details": str(exc),
        }, ensure_ascii=False), file=sys.stderr)
        return 1


def resolve_device(torch, requested):
    if requested:
        return requested
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def resolve_dtype(torch, device):
    if device.startswith("cuda"):
        return torch.float16
    return torch.float32


def to_transcript_json(result, language, model_id):
    chunks = [chunk for chunk in result.get("chunks", []) if valid_chunk(chunk)]
    words = []
    for chunk in chunks:
        start, end = chunk["timestamp"]
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue
        words.append({
            "word": text,
            "start": float(start),
            "end": float(end),
        })

    segment_text = " ".join(word["word"] for word in words).strip()
    segments = []
    if words:
        segments.append({
            "id": 0,
            "start": words[0]["start"],
            "end": words[-1]["end"],
            "text": segment_text,
            "words": words,
        })

    return {
        "language": language,
        "provider": "crisper-whisper",
        "alignmentProvider": "crisper-whisper",
        "segments": segments,
        "metadata": {
            "modelId": model_id,
            "rawText": result.get("text", ""),
        },
    }


def valid_chunk(chunk):
    timestamp = chunk.get("timestamp")
    if not isinstance(timestamp, (list, tuple)) or len(timestamp) != 2:
        return False
    start, end = timestamp
    return isinstance(start, (int, float)) and isinstance(end, (int, float)) and end > start


if __name__ == "__main__":
    raise SystemExit(main())
