#!/usr/bin/env python3
import argparse
import json
import sys
import wave


def main():
    parser = argparse.ArgumentParser(description="Detect speech ranges with Silero VAD.")
    parser.add_argument("--audio", required=True)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--min-speech-ms", type=int, default=250)
    parser.add_argument("--min-silence-ms", type=int, default=450)
    parser.add_argument("--speech-pad-ms", type=int, default=80)
    args = parser.parse_args()

    try:
        import torch
        from silero_vad import get_speech_timestamps, load_silero_vad
    except Exception as exc:
        print(json.dumps({"error": f"silero-vad is not installed or cannot be imported: {exc}"}), file=sys.stderr)
        return 2

    try:
        model = load_silero_vad()
        wav = read_pcm16_wav(args.audio, torch)
        timestamps = get_speech_timestamps(
            wav,
            model,
            sampling_rate=16000,
            threshold=args.threshold,
            min_speech_duration_ms=args.min_speech_ms,
            min_silence_duration_ms=args.min_silence_ms,
            speech_pad_ms=args.speech_pad_ms,
            return_seconds=True,
        )
    except Exception as exc:
        print(json.dumps({"error": f"Silero VAD failed: {exc}"}), file=sys.stderr)
        return 1

    print(json.dumps({
        "provider": "silero-vad",
        "speechRanges": [
            {"start": float(item["start"]), "end": float(item["end"])}
            for item in timestamps
            if float(item["end"]) > float(item["start"])
        ],
    }, ensure_ascii=False))
    return 0


def read_pcm16_wav(audio_path, torch_module):
    with wave.open(audio_path, "rb") as wav_file:
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        sample_rate = wav_file.getframerate()
        frames = wav_file.readframes(wav_file.getnframes())

    if sample_rate != 16000:
        raise ValueError(f"Expected 16 kHz WAV, got {sample_rate} Hz")
    if sample_width != 2:
        raise ValueError(f"Expected 16-bit PCM WAV, got sample width {sample_width}")

    data = torch_module.frombuffer(bytearray(frames), dtype=torch_module.int16).float() / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(dim=1)
    return data


if __name__ == "__main__":
    raise SystemExit(main())
