"""Transcribe a video with word-level timestamps (Scribe or local Whisper).

Adapted from browser-use/video-use (MIT, see studio/licenses/).

Extracts mono 16kHz audio via ffmpeg and transcribes it with:
  - ElevenLabs Scribe (engine "scribe"): verbatim + diarize + audio events.
    Best for filler detection: it keeps "é...", "hã", "tipo" as spoken.
  - faster-whisper on CPU (engine "whisper"): no account needed. Prompted
    with Portuguese fillers so it keeps more of them, but it still drops
    some; review the cut list more carefully with this engine.
  - "auto" (default): Scribe when ELEVENLABS_API_KEY is set, else Whisper.

Both write the same Scribe-shaped JSON to <edit_dir>/transcripts/<stem>.json
(words with type word/spacing/audio_event, start, end, speaker_id).

Cached: if the output file already exists, nothing is re-transcribed.

Usage:
    python studio/helpers/transcribe.py <video_path>
    python studio/helpers/transcribe.py <video_path> --engine whisper --whisper-model medium
    python studio/helpers/transcribe.py <video_path> --edit-dir /custom/edit
    python studio/helpers/transcribe.py <video_path> --language en
    python studio/helpers/transcribe.py <video_path> --num-speakers 2
"""

from __future__ import annotations

import argparse
import array
import json
import math
import os
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import requests


SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text"


def load_api_key(required: bool = True) -> str:
    here = Path(__file__).resolve().parent
    for candidate in [here.parent / ".env", here.parent.parent / ".env", Path(".env")]:
        if candidate.exists():
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == "ELEVENLABS_API_KEY":
                    return v.strip().strip('"').strip("'")
    v = os.environ.get("ELEVENLABS_API_KEY", "")
    if not v and required:
        sys.exit("ELEVENLABS_API_KEY not found in .env or environment (use --engine whisper)")
    return v


# Prompting Whisper with disfluent text makes it transcribe disfluencies
# instead of normalizing them away.
WHISPER_PROMPT = {
    "pt": "Então, é... hum, tipo assim, né, ahn, eu, eu acho que, hã, a gente, é, vai.",
    "en": "Umm, so, uh, like, you know, I, I think, uh, we, um, will.",
}


def call_whisper(audio_path: Path, language: str | None, model_name: str) -> dict:
    """Local faster-whisper, converted to the Scribe response shape."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper not installed: pip install -r studio/requirements.txt")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(audio_path),
        language=language,
        word_timestamps=True,
        vad_filter=False,  # VAD trims the pauses we want to measure
        condition_on_previous_text=False,
        initial_prompt=WHISPER_PROMPT.get(language or "", None),
    )
    words: list[dict] = []
    prev_end: float | None = None
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            if prev_end is not None and w.start > prev_end:
                words.append({"text": " ", "type": "spacing", "start": prev_end,
                              "end": w.start, "speaker_id": "speaker_0"})
            words.append({"text": text, "type": "word", "start": round(w.start, 3),
                          "end": round(w.end, 3), "speaker_id": "speaker_0",
                          "logprob": round(w.probability, 3)})
            prev_end = w.end
    return {
        "language_code": info.language,
        "language_probability": info.language_probability,
        "text": " ".join(w["text"] for w in words if w["type"] == "word"),
        "words": words,
        "engine": f"faster-whisper/{model_name}",
    }


def count_audio_tracks(video_path: Path) -> int:
    """How many audio streams the container holds."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", str(video_path)],
        capture_output=True, text=True,
    )
    return len([ln for ln in out.stdout.splitlines() if ln.strip()])


def peak_dbfs(wav_path: Path) -> float:
    """Peak level of a 16-bit PCM wav, in dBFS. -inf for digital silence."""
    peak = 0
    with wave.open(str(wav_path), "rb") as w:
        # A chunk at a time: batch mode runs several of these at once, and a two-hour
        # take is 230 MB of 16 kHz mono before the array copy doubles it.
        while frames := w.readframes(1 << 16):
            samples = array.array("h", frames)
            peak = max(peak, max(samples), -min(samples))
    return 20 * math.log10(peak / 32768) if peak > 0 else float("-inf")


def extract_audio(video_path: Path, dest: Path, audio_track: int = 0) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-map", f"0:a:{audio_track}",
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(dest),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def call_scribe(
    audio_path: Path,
    api_key: str,
    language: str | None = None,
    num_speakers: int | None = None,
) -> dict:
    data: dict[str, str] = {
        "model_id": "scribe_v1",
        "diarize": "true",
        "tag_audio_events": "true",
        "timestamps_granularity": "word",
    }
    if language:
        data["language_code"] = language
    if num_speakers:
        data["num_speakers"] = str(num_speakers)

    with open(audio_path, "rb") as f:
        resp = requests.post(
            SCRIBE_URL,
            headers={"xi-api-key": api_key},
            files={"file": (audio_path.name, f, "audio/wav")},
            data=data,
            timeout=1800,
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Scribe returned {resp.status_code}: {resp.text[:500]}")

    return resp.json()


def transcript_path(edit_dir: Path, video: Path, audio_track: int = 0) -> Path:
    """Where a video's transcript lands.

    The track belongs in the name, or a rerun with --audio-track hands back the transcript of
    the track it is meant to replace. Track 0 keeps the plain name, so transcripts made before
    the flag existed stay valid. Batch mode tests its cache with this too — one function, so
    the two cannot drift apart.
    """
    suffix = "" if audio_track == 0 else f".track{audio_track}"
    return edit_dir / "transcripts" / f"{video.stem}{suffix}.json"


def transcribe_one(
    video: Path,
    edit_dir: Path,
    api_key: str,
    language: str | None = None,
    num_speakers: int | None = None,
    verbose: bool = True,
    audio_track: int = 0,
    engine: str = "auto",
    whisper_model: str = "small",
) -> Path:
    """Transcribe a single video. Returns path to transcript JSON.

    Cached: returns existing path immediately if the transcript already exists.
    """
    transcripts_dir = edit_dir / "transcripts"
    transcripts_dir.mkdir(parents=True, exist_ok=True)
    out_path = transcript_path(edit_dir, video, audio_track)

    if out_path.exists():
        if verbose:
            print(f"cached: {out_path.name}")
        return out_path

    if verbose:
        print(f"  extracting audio from {video.name}", flush=True)

    n_tracks = count_audio_tracks(video)
    if n_tracks > 1 and verbose:
        print(f"  note: {video.name} has {n_tracks} audio tracks, using track "
              f"{audio_track + 1} (--audio-track to change)", flush=True)

    t0 = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp) / f"{video.stem}.wav"
        extract_audio(video, audio, audio_track)

        # Uploading silence costs the same as uploading speech and returns
        # nothing, so catch the wrong-track case before paying for it.
        peak = peak_dbfs(audio)
        if peak < -60.0:
            raise RuntimeError(
                f"track {audio_track + 1} of {video.name} is silent "
                f"(peak {peak:.1f} dBFS) - not uploading. "
                + (f"The file has {n_tracks} audio tracks; try --audio-track "
                   + " or ".join(str(i) for i in range(n_tracks) if i != audio_track) + "."
                   if n_tracks > 1 else "Check the source audio.")
            )

        if engine == "auto":
            engine = "scribe" if api_key else "whisper"
        if engine == "scribe":
            size_mb = audio.stat().st_size / (1024 * 1024)
            if verbose:
                print(f"  uploading {video.stem}.wav ({size_mb:.1f} MB) to Scribe", flush=True)
            payload = call_scribe(audio, api_key, language, num_speakers)
        else:
            if verbose:
                print(f"  transcribing {video.stem}.wav locally (whisper {whisper_model})", flush=True)
            payload = call_whisper(audio, language, whisper_model)

    out_path.write_text(json.dumps(payload, indent=2))
    dt = time.time() - t0

    if verbose:
        kb = out_path.stat().st_size / 1024
        print(f"  saved: {out_path.name} ({kb:.1f} KB) in {dt:.1f}s")
        if isinstance(payload, dict) and "words" in payload:
            print(f"    words: {len(payload['words'])}")

    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description="Transcribe a video with ElevenLabs Scribe")
    ap.add_argument("video", type=Path, help="Path to video file")
    ap.add_argument(
        "--edit-dir",
        type=Path,
        default=None,
        help="Edit output directory (default: <video_parent>/edit)",
    )
    ap.add_argument(
        "--language",
        type=str,
        default="pt",
        help="ISO language code. Default 'pt'; pass 'auto' to auto-detect.",
    )
    ap.add_argument(
        "--num-speakers",
        type=int,
        default=None,
        help="Optional number of speakers when known. Improves diarization accuracy.",
    )
    ap.add_argument(
        "--audio-track",
        type=int,
        default=0,
        help="Zero-based audio track to transcribe. OBS writes the game on track 0 "
             "and the mic on track 1; without this ffmpeg applies its default audio "
             "stream selection, which picks the track with the most channels.",
    )
    ap.add_argument("--engine", choices=["auto", "scribe", "whisper"], default="auto",
                    help="auto = Scribe if ELEVENLABS_API_KEY is set, else local Whisper")
    ap.add_argument("--whisper-model", default="small",
                    help="faster-whisper model: small (fast), medium, large-v3 (best)")
    args = ap.parse_args()

    video = args.video.resolve()
    if not video.exists():
        sys.exit(f"video not found: {video}")

    edit_dir = (args.edit_dir or (video.parent / "edit")).resolve()
    api_key = load_api_key(required=args.engine == "scribe")

    transcribe_one(
        video=video,
        edit_dir=edit_dir,
        api_key=api_key,
        language=None if args.language == "auto" else args.language,
        num_speakers=args.num_speakers,
        audio_track=args.audio_track,
        engine=args.engine,
        whisper_model=args.whisper_model,
    )


if __name__ == "__main__":
    main()
