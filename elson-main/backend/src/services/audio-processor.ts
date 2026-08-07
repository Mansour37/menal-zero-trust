/**
 * Audio post-processing pipeline.
 * Runs after upload to produce Whisper-ready audio files.
 *
 * Pipeline:
 * 1. Convert WebM Opus → WAV 16kHz mono (Whisper native format)
 * 2. Loudness normalization (EBU R128 → -16 LUFS)
 * 3. High-pass filter at 80Hz (removes rumble, wind, AC hum)
 * 4. Noise gate (suppress silence/low-level noise between speech)
 * 5. Validate: check duration and detect if speech is present
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);

interface ProcessResult {
  outputPath: string;       // path to processed WAV
  durationMs: number;       // actual audio duration in ms
  sampleRate: number;       // always 16000
  peakDb: number;           // peak level in dB (detect silence)
  valid: boolean;           // true if audio contains usable speech
  error?: string;
}

/**
 * Process an uploaded audio file into a Whisper-ready WAV.
 * The original file is kept; a .wav version is created alongside it.
 * ffmpeg only works on plain local files: callers run this on the STAGING copy
 * (services/storage stagingDir()) and then push original + WAV via storage.putFile.
 */
export async function processAudio(inputPath: string): Promise<ProcessResult> {
  const ext = path.extname(inputPath);
  // A .wav INPUT would otherwise map onto itself and ffmpeg refuses to overwrite its
  // own input ("output same as input") → every wav upload would be falsely rejected.
  const outputPath = ext.toLowerCase() === ".wav"
    ? inputPath.replace(/\.wav$/i, "_p.wav")
    : inputPath.replace(ext, ".wav");

  try {
    // SINGLE FFmpeg pass: convert + normalize + filter + measure peak.
    // - highpass: removes frequencies below 80Hz (wind, rumble)
    // - loudnorm: EBU R128 normalization to -16 LUFS
    // - agate: noise gate — suppresses audio below -30dB threshold
    // - volumedetect: appended to the chain → prints max_volume to stderr in the SAME
    //   pass (pass-through, doesn't alter the output), so we drop the separate decode.
    // - ar 16000 / ac 1 / pcm_s16le: Whisper-native 16kHz mono 16-bit WAV.
    // Perf: 3 ffmpeg/ffprobe spawns → 1. Duration is derived from the PCM size below
    // (no ffprobe). Quality is unchanged (identical filters; peak measured on the same
    // processed audio as before).
    const conv = await exec("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-af", "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11,agate=threshold=-30dB:ratio=2:attack=10:release=250,volumedetect",
      "-ar", "16000",
      "-ac", "1",
      "-acodec", "pcm_s16le",
      outputPath,
    ], { timeout: 30_000 });

    // Duration: exact from the PCM WAV size — 16kHz × 2 bytes × mono = 32000 B/s,
    // minus the 44-byte WAV header. No ffprobe spawn needed.
    const st = await fs.stat(outputPath);
    const durationMs = Math.max(0, Math.round((st.size - 44) / 32));

    // Peak level from the SAME pass's volumedetect output (no extra decode).
    const stderr = (conv as { stderr?: string }).stderr ?? "";
    const peakMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
    const peakDb = peakMatch ? parseFloat(peakMatch[1]) : -100;

    // Audio is valid if: duration >= 1.5s AND peak > -35dB (not silence)
    const valid = durationMs >= 1500 && peakDb > -35;

    return {
      outputPath,
      durationMs,
      sampleRate: 16000,
      peakDb,
      valid,
      error: valid ? undefined : peakDb <= -35 ? "Audio appears to be silence" : "Audio too short",
    };
  } catch (err: any) {
    return {
      outputPath: inputPath,
      durationMs: 0,
      sampleRate: 0,
      peakDb: -100,
      valid: false,
      error: `FFmpeg processing failed: ${err.message?.slice(0, 200)}`,
    };
  }
}

/**
 * Check if FFmpeg is available.
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  try {
    await exec("ffmpeg", ["-version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
