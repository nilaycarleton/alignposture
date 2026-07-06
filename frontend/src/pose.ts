import {
  FilesetResolver,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

export interface PostureMetrics {
  head_forward: number;
  torso_length: number;
  shoulder_tilt: number;
  visibility: number;
}

let modelPromise: Promise<PoseLandmarker> | null = null;

function model(): Promise<PoseLandmarker> {
  if (!modelPromise) {
    modelPromise = FilesetResolver.forVisionTasks("/wasm").then((vision) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }),
    );
  }
  return modelPromise;
}

export const preparePoseModel = () => model().then(() => undefined);

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

function metrics(landmarks: NormalizedLandmark[]): PostureMetrics {
  const [le, re, ls, rs, lh, rh] = [7, 8, 11, 12, 23, 24].map(
    (index) => landmarks[index],
  );
  const shoulderWidth = Math.max(distance(ls, rs), 0.000001);
  // Laptop cameras rarely include the hips. Use head/shoulder confidence for
  // frame acceptance; MediaPipe can still estimate lower torso landmarks.
  const visibility = Math.min(
    ...[le, re, ls, rs].map((point) => point.visibility ?? 1),
  );
  return {
    head_forward: Math.abs((le.z + re.z) / 2 - (ls.z + rs.z) / 2) / shoulderWidth,
    torso_length: Math.abs((lh.y + rh.y) / 2 - (ls.y + rs.y) / 2) / shoulderWidth,
    shoulder_tilt: (ls.y - rs.y) / shoulderWidth,
    visibility,
  };
}

export async function detectPosture(
  video: HTMLVideoElement,
): Promise<PostureMetrics | null> {
  if (!video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null;
  }
  const landmarker = await model();
  const result = landmarker.detectForVideo(video, performance.now());
  return result.landmarks.length ? metrics(result.landmarks[0]) : null;
}
