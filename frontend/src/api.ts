export type PostureState = "good" | "warning" | "slouching" | "no_pose";

export interface FrameResult {
  mode?: "calibration";
  progress?: number;
  captured_frames?: number;
  accepted?: boolean;
  visibility?: number;
  score?: number;
  state?: PostureState;
  confidence?: number;
  reasons?: string[];
  message?: string;
}

export interface PostureMetrics {
  head_forward: number;
  torso_length: number;
  shoulder_tilt: number;
  visibility: number;
}

export interface HistoryData {
  events: Array<{
    timestamp: string;
    score: number;
    state: PostureState;
    confidence: number;
    session_id: string;
  }>;
  summary: {
    samples: number;
    sessions: number;
    good_posture_percent: number;
    average_score: number;
  };
}

export interface CalibrationComplete {
  id: string;
  name: string;
  created_at: string | null;
  guest?: boolean;
}

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Something went wrong. Please try again.");
  }
  return response.json();
}

export const api = {
  setTokenProvider: (provider: TokenProvider) => {
    tokenProvider = provider;
  },
  health: () => request<{ status: string; service: string }>("/api/health"),
  status: () => request<{ profile_ready: boolean }>("/api/status"),
  startCalibration: (name: string, sensitivity: number) =>
    request<{ id: string; required_frames: number }>("/api/calibrations", {
      method: "POST",
      body: JSON.stringify({ name, sensitivity }),
    }),
  sendMetrics: (
    metrics: PostureMetrics,
    calibration_id?: string,
    session_id?: string,
    profile_id?: string,
  ) =>
    request<FrameResult>("/api/metrics", {
      method: "POST",
      body: JSON.stringify({ ...metrics, calibration_id, session_id, profile_id }),
    }),
  completeCalibration: (id: string) =>
    request<CalibrationComplete>(`/api/calibrations/${id}/complete`, { method: "POST" }),
  claimGuestProfile: (id: string) =>
    request<{ id: string; name: string; created_at: string }>(
      `/api/guest-profiles/${id}/claim`,
      { method: "POST" },
    ),
  startSession: () =>
    request<{ id: string; started_at: string }>("/api/sessions", { method: "POST" }),
  completeSession: (id: string) =>
    request(`/api/sessions/${id}/complete`, { method: "POST" }),
  history: () => request<HistoryData>("/api/history"),
};
