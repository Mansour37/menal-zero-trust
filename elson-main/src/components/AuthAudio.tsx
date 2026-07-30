"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAuthAudio } from "@/lib/api";

/**
 * Audio player that fetches the file with JWT auth (blob URL, no token in <audio src>).
 *
 * Anti-fraud:
 *  • controlsList=nodownload + blocked right-click → can't save the file in one tap.
 *  • onCompleted fires only after the listener has actually PLAYED ~the whole clip
 *    (forward progress is accumulated; seeking ahead is ignored), so a rushed
 *    evaluator can't rate without having waited the audio's real length.
 */
export function AuthAudio({ src, style, onCompleted, autoPlay }: { src: string | null; style?: React.CSSProperties; onCompleted?: () => void; autoPlay?: boolean }) {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const played = useRef(0);       // accumulated seconds actually listened (skip-proof)
  const lastT = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    if (!src) return;
    let revoke = "";
    played.current = 0; lastT.current = 0; done.current = false;
    fetchAuthAudio(src).then((url) => { setBlobUrl(url); revoke = url; });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  // Auto-play as soon as the clip is loaded (the evaluator can't proceed without it).
  useEffect(() => {
    if (autoPlay && blobUrl && audioRef.current) {
      audioRef.current.play().catch(() => { /* browser blocked autoplay → user taps play */ });
    }
  }, [autoPlay, blobUrl]);

  if (!src || !blobUrl) return null;

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    const dt = a.currentTime - lastT.current;
    if (dt > 0 && dt < 1.2) played.current += dt; // only normal forward playback counts
    lastT.current = a.currentTime;
    if (!done.current && a.duration > 0 && played.current >= a.duration * 0.9) {
      done.current = true;
      onCompleted?.();
    }
  };
  // A seek just re-anchors the reference — it never adds to the listened total.
  const onSeeking = (e: React.SyntheticEvent<HTMLAudioElement>) => { lastT.current = e.currentTarget.currentTime; };
  const onEnded = () => { if (!done.current) { done.current = true; onCompleted?.(); } };

  return (
    <audio
      ref={audioRef}
      controls
      autoPlay={autoPlay}
      controlsList="nodownload noplaybackrate noremoteplayback"
      onContextMenu={(e) => e.preventDefault()}
      onTimeUpdate={onTimeUpdate}
      onSeeking={onSeeking}
      onEnded={onEnded}
      src={blobUrl}
      style={{ width: "100%", height: 32, ...style }}
    />
  );
}
