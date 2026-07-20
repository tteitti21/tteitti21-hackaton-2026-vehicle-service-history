import os
import sys
from pathlib import Path

from openai import OpenAI


INPUT_FILE = Path("narration.txt")
OUTPUT_FILE = Path("narration.mp3")


def main() -> None:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print(
            "OPENAI_API_KEY is not configured.\n"
            "PowerShell example:\n"
            '$env:OPENAI_API_KEY="your-api-key-here"',
            file=sys.stderr,
        )
        raise SystemExit(1)

    if not INPUT_FILE.exists():
        print(f"Missing input file: {INPUT_FILE}", file=sys.stderr)
        raise SystemExit(1)

    narration = INPUT_FILE.read_text(encoding="utf-8").strip()

    if not narration:
        print("narration.txt is empty.", file=sys.stderr)
        raise SystemExit(1)

    # The speech endpoint currently accepts no more than 4096 input characters.
    if len(narration) > 4096:
        print(
            f"The narration contains {len(narration)} characters.\n"
            "Split it into smaller sections because the API limit is "
            "4096 characters per request.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    client = OpenAI(api_key=api_key)

    print("Generating narration...")

    with client.audio.speech.with_streaming_response.create(
        model="gpt-4o-mini-tts",
        voice="onyx",
        input=narration,
        instructions=(
            "Deliver this as a polished software demonstration narration. "
            "Speak clearly, confidently, and naturally at a moderately brisk pace. "
            "Use brief pauses between paragraphs. "
            "Avoid an exaggerated advertising tone."
        ),
        response_format="mp3",
        speed=1.12,
    ) as response:
        response.stream_to_file(OUTPUT_FILE)

    print(f"Created: {OUTPUT_FILE.resolve()}")


if __name__ == "__main__":
    main()
