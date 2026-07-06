import { RefObject, useCallback, useEffect, useRef, useState } from "react";

export function useCamera(videoRef: RefObject<HTMLVideoElement>) {
  const stream = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "ready" | "denied">("idle");

  const start = useCallback(async () => {
    if (stream.current) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream.current;
        await videoRef.current.play();
      }
      setStatus("ready");
      return;
    }
    setStatus("requesting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream.current;
        await videoRef.current.play();
      }
      setStatus("ready");
    } catch {
      setStatus("denied");
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => stop, [stop]);
  return { status, start, stop };
}
