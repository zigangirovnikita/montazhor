#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

FILLER_RE = re.compile(r"^(ээ+|эм+|мм+|аа+|нуу+|ну|uh+|um+)$", re.IGNORECASE)


def main():
    parser = argparse.ArgumentParser(description="Compare baseline and candidate transcript outputs.")
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    args = parser.parse_args()

    baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    candidate = json.loads(Path(args.candidate).read_text(encoding="utf-8"))

    baseline_words = collect_words(baseline)
    candidate_words = collect_words(candidate)
    report = {
        "baselineWordCount": len(baseline_words),
        "candidateWordCount": len(candidate_words),
        "baselineFillers": filler_summary(baseline_words),
        "candidateFillers": filler_summary(candidate_words),
        "baselineTextSample": " ".join(baseline_words[:60]),
        "candidateTextSample": " ".join(candidate_words[:60]),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


def collect_words(transcript):
    words = []
    for segment in transcript.get("segments", []):
        for word in segment.get("words", []) or []:
            text = normalize(str(word.get("word", "")))
            if text:
                words.append(text)
    return words


def filler_summary(words):
    fillers = [word for word in words if FILLER_RE.match(word)]
    return {
        "count": len(fillers),
        "samples": fillers[:20],
    }


def normalize(text):
    return re.sub(r"\s+", " ", text.strip().lower())


if __name__ == "__main__":
    main()
