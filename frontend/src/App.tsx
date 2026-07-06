import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useClerk,
} from "@clerk/react";
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  CircleHelp,
  Home,
  LockKeyhole,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  X,
} from "lucide-react";
import { api, FrameResult, HistoryData } from "./api";
import { Brand } from "./components/Brand";
import { CameraPanel } from "./components/CameraPanel";
import { useCamera } from "./hooks/useCamera";
import { detectPosture, preparePoseModel } from "./pose";

type View = "home" | "setup" | "coach" | "history";
type Theme = "light" | "dark";
const History = lazy(() =>
  import("./components/History").then((module) => ({ default: module.History })),
);

export default function App() {
  const [view, setView] = useState<View>("home");
  const [profileReady, setProfileReady] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem("align-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  useEffect(() => {
    api.setTokenProvider(() => getToken());
  }, [getToken]);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      camera.stop();
      setProfileReady(false);
      setView("home");
      return;
    }
    api.status()
      .then((result) => setProfileReady(result.profile_ready))
      .catch(() => setProfileReady(false));
  }, [isLoaded, isSignedIn, camera.stop]);
  useEffect(() => {
    if (view === "history") api.history().then(setHistory).catch(() => setHistory(null));
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("align-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  const navigate = (next: View) => {
    if (next !== "setup" && next !== "coach") camera.stop();
    setView(next);
  };
  const navigateProtected = (next: "setup" | "coach" | "history") => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    navigate(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand-button" onClick={() => navigate("home")}><Brand /></button>
        <nav aria-label="Main navigation">
          <button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><Home /> Home</button>
          <button className={view === "coach" ? "active" : ""} onClick={() => navigateProtected(profileReady ? "coach" : "setup")}><Sparkles /> Coach</button>
          <button className={view === "history" ? "active" : ""} onClick={() => navigateProtected("history")}><BarChart3 /> Progress</button>
        </nav>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
          <button
            className="icon-button"
            aria-label="Open help"
            title="Help"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp />
          </button>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="auth-link">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="button primary auth-signup">Create account</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <main>
        {view === "home" && <HomeView onStart={() => navigateProtected(profileReady ? "coach" : "setup")} />}
        {view === "setup" && (
          <SetupView
            videoRef={videoRef}
            camera={camera}
            onComplete={() => { setProfileReady(true); setView("coach"); }}
          />
        )}
        {view === "coach" && (
          <CoachView
            videoRef={videoRef}
            camera={camera}
            onRecalibrate={() => {
              camera.stop();
              setView("setup");
            }}
          />
        )}
        {view === "history" && <div className="page"><PageHeading eyebrow="Your progress" title="Small habits, made visible." subtitle="Review recent coaching sessions and notice when your posture feels best." /><Suspense fallback={<section className="empty-history"><p>Loading your progress…</p></section>}><History data={history} /></Suspense></div>}
      </main>
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="help-header">
          <div>
            <p className="eyebrow">Align Posture support</p>
            <h2 id="help-title">How can we help?</h2>
            <p>Everything you need for a smooth posture session.</p>
          </div>
          <button className="icon-button" aria-label="Close help" onClick={onClose} autoFocus>
            <X />
          </button>
        </div>

        <div className="help-content">
          <article className="help-section">
            <span className="help-section-icon"><Camera /></span>
            <div>
              <h3>Start a session</h3>
              <ol>
                <li>Open <strong>Coach</strong> and enable your camera.</li>
                <li>Keep your face and both shoulders in view.</li>
                <li>Hold a comfortable posture during calibration.</li>
                <li>Select <strong>Start coaching</strong> for live feedback.</li>
              </ol>
            </div>
          </article>

          <article className="help-section">
            <span className="help-section-icon"><RefreshCw /></span>
            <div>
              <h3>If detection stops</h3>
              <ul>
                <li>Check that both app terminals are still running.</li>
                <li>Move into brighter, even lighting.</li>
                <li>Use <strong>Recalibrate for a new setup</strong> after moving your camera.</li>
                <li>Hard-refresh with <strong>Command + Shift + R</strong> after updates.</li>
              </ul>
            </div>
          </article>

          <aside className="help-privacy">
            <LockKeyhole />
            <div>
              <strong>Your camera stays private</strong>
              <p>Video is processed in your browser. Align Posture saves scores—not images.</p>
            </div>
          </aside>
        </div>

        <div className="help-footer">
          <p>Align Posture provides wellness guidance and is not a medical diagnostic tool.</p>
          <button className="button primary" onClick={onClose}>Got it</button>
        </div>
      </section>
    </div>
  );
}

function HomeView({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="badge"><ShieldCheck /> Private by design</div>
        <h1>Better posture,<br /><em>without the nagging.</em></h1>
        <p>Align Posture learns your natural sitting position and offers gentle, real-time cues when you begin to slouch.</p>
        <div className="hero-actions">
          <button className="button primary large" onClick={onStart}>Start a session <ArrowRight /></button>
          <span>Free account · Setup takes one minute</span>
        </div>
        <div className="trust-row">
          <div><Check /> Personalized calibration</div>
          <div><Check /> Local processing</div>
          <div><Check /> Progress insights</div>
        </div>
      </div>
      <div className="hero-visual" aria-label="Posture Coach preview">
        <div className="preview-window">
          <div className="preview-top"><Brand /><span className="live-dot">Live</span></div>
          <div className="silhouette"><span className="head" /><span className="body" /><span className="guide-line" /></div>
          <div className="preview-status"><span><Check /></span><div><strong>Looking good</strong><p>Your posture is close to baseline</p></div><b>12</b></div>
        </div>
        <div className="floating-card"><Sparkles /><div><strong>Gentle guidance</strong><span>Only when you need it</span></div></div>
      </div>
    </section>
  );
}

function SetupView({ videoRef, camera, onComplete }: any) {
  const [step, setStep] = useState<"camera" | "position" | "calibrate">("camera");
  const [calibrationId, setCalibrationId] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const failures = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (camera.status === "ready" && step === "camera") setStep("position");
  }, [camera.status, step]);

  useEffect(() => {
    if (step !== "calibrate" || !calibrationId) return;
    const timer = window.setInterval(async () => {
      if (busy.current || !videoRef.current) return;
      busy.current = true;
      try {
        const metrics = await detectPosture(videoRef.current);
        if (!metrics) {
          setError("Move until your face and both shoulders are visible.");
          return;
        }
        const result = await api.sendMetrics(metrics, calibrationId);
        failures.current = 0;
        if (result.accepted === false) {
          setError(result.message || "Keep your face and both shoulders visible.");
          return;
        }
        setError("");
        setProgress(result.progress ?? 0);
        if ((result.progress || 0) >= 100) {
          window.clearInterval(timer);
          await api.completeCalibration(calibrationId);
          onComplete();
        }
      } catch (reason) {
        failures.current += 1;
        setError(
          failures.current >= 3
            ? "Calibration lost connection to the posture service. Make sure the API terminal is running, then restart calibration."
            : reason instanceof Error ? reason.message : "Calibration paused.",
        );
      } finally {
        busy.current = false;
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [step, calibrationId, videoRef, onComplete]);

  const begin = async () => {
    setError("Loading the private posture model…");
    try {
      await preparePoseModel();
      const calibration = await api.startCalibration("My desk", 1);
      setCalibrationId(calibration.id);
      setError("");
      setStep("calibrate");
    } catch {
      setError("The posture model could not load. Refresh the page and make sure both app terminals are running.");
    }
  };

  return (
    <div className="page setup-page">
      <PageHeading eyebrow="Personal setup" title="Let’s find your neutral posture." subtitle="Sit naturally—not perfectly. Align Posture will learn what comfortable and upright looks like for you." />
      <div className="stepper">
        {["Camera", "Position", "Calibrate"].map((label, index) => {
          const current = ["camera", "position", "calibrate"].indexOf(step);
          return <div className={index <= current ? "current" : ""} key={label}><span>{index < current ? <Check /> : index + 1}</span>{label}</div>;
        })}
      </div>
      <div className="setup-grid">
        <CameraPanel videoRef={videoRef} cameraStatus={camera.status} onEnable={camera.start}>
          {step === "calibrate" && <div className="calibration-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><strong>{progress}%</strong><span>Stay comfortable</span></div>}
        </CameraPanel>
        <aside className="instruction-card">
          {step === "camera" && <><p className="eyebrow">Step 1</p><h2>Turn on your camera</h2><p>Your video stays on this device. We only save posture scores—not images.</p><button className="button primary full" onClick={camera.start}>Enable camera</button></>}
          {step === "position" && <><p className="eyebrow">Step 2</p><h2>Get comfortably in frame</h2><ul className="check-list"><li><Check /> Face and both shoulders are visible</li><li><Check /> Camera is near eye level</li><li><Check /> Sit as you normally work</li></ul><button className="button primary full" onClick={begin}>I’m ready to calibrate</button></>}
          {step === "calibrate" && <><p className="eyebrow">Step 3</p><h2>Hold your natural posture</h2><p>Keep looking toward the screen. This takes about six seconds.</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}% complete</strong></>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </aside>
      </div>
    </div>
  );
}

function CoachView({ videoRef, camera, onRecalibrate }: any) {
  const [sessionId, setSessionId] = useState<string>();
  const [result, setResult] = useState<FrameResult>({});
  const [seconds, setSeconds] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    camera.start();
  }, [camera.start]);
  useEffect(() => {
    if (!sessionId) return;
    const clock = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    const frames = window.setInterval(async () => {
      if (busy.current || !videoRef.current) return;
      busy.current = true;
      try {
        const metrics = await detectPosture(videoRef.current);
        if (metrics) setResult(await api.sendMetrics(metrics, undefined, sessionId));
        else setResult({ state: "no_pose", message: "Move your upper body into view." });
      } finally { busy.current = false; }
    }, 350);
    return () => { window.clearInterval(clock); window.clearInterval(frames); };
  }, [sessionId, videoRef]);

  const start = async () => { const session = await api.startSession(); setSessionId(session.id); setSeconds(0); };
  const stop = async () => { if (sessionId) await api.completeSession(sessionId); setSessionId(undefined); };
  const state = result.state || "no_pose";
  const stateCopy = state === "good" ? "Looking good" : state === "warning" ? "A small reset may help" : state === "slouching" ? "Time to gently realign" : "Finding your posture";

  return (
    <div className="page coach-page">
      <div className="coach-heading"><PageHeading eyebrow="Live coach" title={sessionId ? stateCopy : "Ready when you are."} subtitle={sessionId ? (result.reasons?.[0] || result.message || "Sit naturally and keep your upper body in view.") : "Start a focused posture session whenever you settle in to work."} /><div className="session-time">{sessionId ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "00:00"}<span>Session time</span></div></div>
      <div className="coach-grid">
        <CameraPanel videoRef={videoRef} cameraStatus={camera.status} onEnable={camera.start} state={state}>
          {sessionId && <div className={`live-score ${state}`}><span>Posture score</span><strong>{Math.round(result.score || 0)}</strong><small>Lower is better</small></div>}
        </CameraPanel>
        <aside className="coach-sidebar">
          <div className={`status-card ${state}`}><span className="status-orb">{state === "good" ? <Check /> : <Sparkles />}</span><div><p>Current posture</p><h3>{stateCopy}</h3></div></div>
          <div className="tip-card"><p className="eyebrow">A gentle cue</p><h3>{result.reasons?.[0] || "Relax your shoulders and settle in."}</h3><p>There is no perfect posture. Comfortable movement matters more than holding still.</p></div>
          {!sessionId ? <button className="button primary full large" onClick={start}>Start coaching <ArrowRight /></button> : <button className="button stop full large" onClick={stop}><Square /> End session</button>}
          <button className="text-button" onClick={onRecalibrate}><RefreshCw /> Recalibrate for a new setup</button>
        </aside>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>;
}
