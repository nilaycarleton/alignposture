import { Camera, CameraOff, LockKeyhole } from "lucide-react";
import { RefObject } from "react";

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  cameraStatus: "idle" | "requesting" | "ready" | "denied";
  onEnable: () => void;
  state?: string;
  children?: React.ReactNode;
}

export function CameraPanel({ videoRef, cameraStatus, onEnable, state, children }: Props) {
  return (
    <div className={`camera-shell state-${state || "idle"}`}>
      <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
      {cameraStatus !== "ready" && (
        <div className="camera-empty">
          <span className="camera-icon">
            {cameraStatus === "denied" ? <CameraOff /> : <Camera />}
          </span>
          <h3>{cameraStatus === "denied" ? "Camera access is blocked" : "Your camera is off"}</h3>
          <p>
            {cameraStatus === "denied"
              ? "Allow camera access in your browser settings, then try again."
              : "Align Posture needs your camera to understand your posture."}
          </p>
          <button className="button primary" onClick={onEnable}>
            {cameraStatus === "requesting" ? "Waiting for permission…" : "Enable camera"}
          </button>
        </div>
      )}
      {cameraStatus === "ready" && <div className="pose-guide" aria-hidden="true" />}
      {children}
      <div className="privacy-pill"><LockKeyhole size={13} /> Processed locally</div>
    </div>
  );
}
