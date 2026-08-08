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
  FileText,
  Github,
  Home,
  LockKeyhole,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  X,
} from "lucide-react";
import { api, CalibrationComplete, FrameResult, HistoryData } from "./api";
import { Brand } from "./components/Brand";
import { CameraPanel } from "./components/CameraPanel";
import { useCamera } from "./hooks/useCamera";
import { detectPosture, preparePoseModel } from "./pose";

type View =
  | "home"
  | "setup"
  | "coach"
  | "history"
  | "privacy"
  | "terms"
  | "cookies"
  | "disclaimer"
  | "contact";
type Theme = "light" | "dark";

const History = lazy(() =>
  import("./components/History").then((module) => ({ default: module.History })),
);

export default function App() {
  const [view, setView] = useState<View>("home");
  const [savedProfileReady, setSavedProfileReady] = useState(false);
  const [guestProfileId, setGuestProfileId] = useState<string>();
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem("align-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera(videoRef);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const profileReady = isSignedIn ? savedProfileReady : Boolean(guestProfileId);

  useEffect(() => {
    api.setTokenProvider(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setSavedProfileReady(false);
      if (view === "history") setView("home");
      return;
    }
    api.status()
      .then((result) => setSavedProfileReady(result.profile_ready))
      .catch(() => setSavedProfileReady(false));
  }, [isLoaded, isSignedIn, view]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !guestProfileId) return;
    setSaveStatus("Saving this calibration to your account...");
    api.claimGuestProfile(guestProfileId)
      .then(() => {
        setSavedProfileReady(true);
        setGuestProfileId(undefined);
        setSaveStatus("Your calibration is saved. New sessions will appear in Progress.");
      })
      .catch(() => {
        setSaveStatus("This guest setup expired. Recalibrate after signing in to save progress.");
      });
  }, [guestProfileId, isLoaded, isSignedIn]);

  useEffect(() => {
    if (view === "history" && isSignedIn) {
      api.history().then(setHistory).catch(() => setHistory(null));
    }
  }, [view, isSignedIn]);

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

  const goCoach = () => navigate(profileReady ? "coach" : "setup");
  const goProgress = () => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    navigate("history");
  };
  const saveProgress = () => {
    setSaveStatus("Create an account or sign in to save future sessions.");
    openSignIn();
  };

  return (
    <div className="app">
      <Header
        view={view}
        theme={theme}
        isSignedIn={Boolean(isSignedIn)}
        profileReady={profileReady}
        onHome={() => navigate("home")}
        onCoach={goCoach}
        onProgress={goProgress}
        onSave={saveProgress}
        onHelp={() => setHelpOpen(true)}
        onTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      />

      <main id="main">
        {view === "home" && (
          <HomeView onStart={goCoach} onSave={saveProgress} isSignedIn={Boolean(isSignedIn)} />
        )}
        {view === "setup" && (
          <SetupView
            videoRef={videoRef}
            camera={camera}
            isSignedIn={Boolean(isSignedIn)}
            onComplete={(profile) => {
              if (profile.guest) setGuestProfileId(profile.id);
              else setSavedProfileReady(true);
              setView("coach");
            }}
          />
        )}
        {view === "coach" && (
          <CoachView
            videoRef={videoRef}
            camera={camera}
            isSignedIn={Boolean(isSignedIn)}
            profileReady={profileReady}
            guestProfileId={guestProfileId}
            onSignInToSave={saveProgress}
            onRecalibrate={() => {
              camera.stop();
              setView("setup");
            }}
          />
        )}
        {view === "history" && (
          <div className="page">
            <PageHeading
              eyebrow="Saved progress"
              title="Your posture trend line."
              subtitle="Review signed-in coaching sessions and notice when your setup feels best."
            />
            <Suspense fallback={<section className="empty-history"><p>Loading progress...</p></section>}>
              <History data={history} />
            </Suspense>
          </div>
        )}
        {isLegalView(view) && <LegalPage view={view} />}
      </main>

      {saveStatus && <SaveNotice message={saveStatus} onDismiss={() => setSaveStatus("")} />}
      <Footer onNavigate={navigate} />
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function Header({
  view,
  theme,
  isSignedIn,
  profileReady,
  onHome,
  onCoach,
  onProgress,
  onSave,
  onHelp,
  onTheme,
}: {
  view: View;
  theme: Theme;
  isSignedIn: boolean;
  profileReady: boolean;
  onHome: () => void;
  onCoach: () => void;
  onProgress: () => void;
  onSave: () => void;
  onHelp: () => void;
  onTheme: () => void;
}) {
  return (
    <header className="site-header">
      <a className="skip-nav" href="#main">Skip to content</a>
      <button className="brand-button" onClick={onHome}><Brand /></button>
      <nav className="nav-tabs" aria-label="Main navigation">
        <button className={view === "home" ? "active" : ""} onClick={onHome}><Home /> Home</button>
        <button className={view === "coach" || view === "setup" ? "active" : ""} onClick={onCoach}>
          <Sparkles /> {profileReady ? "Coach" : "Try coach"}
        </button>
        <button className={view === "history" ? "active" : ""} onClick={onProgress}>
          {isSignedIn ? <BarChart3 /> : <LockKeyhole />} Progress
        </button>
      </nav>
      <div className="top-actions">
        {!isSignedIn && <button className="mage-button save-button" onClick={onSave}>Save progress</button>}
        <button
          className="icon-button"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          onClick={onTheme}
        >
          {theme === "light" ? <Moon /> : <Sun />}
        </button>
        <button className="icon-button" aria-label="Open help" title="Help" onClick={onHelp}>
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
  );
}

function SaveNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <aside className="save-notice" role="status">
      <ShieldCheck />
      <p>{message}</p>
      <button className="icon-button compact" aria-label="Dismiss save message" onClick={onDismiss}><X /></button>
    </aside>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
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
                <li>Open Coach and enable your camera.</li>
                <li>Keep your face and both shoulders in view.</li>
                <li>Hold a comfortable posture during calibration.</li>
                <li>Select Start coaching for live feedback.</li>
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
                <li>Use Recalibrate after moving your camera.</li>
                <li>Hard-refresh after updates.</li>
              </ul>
            </div>
          </article>

          <aside className="help-privacy">
            <LockKeyhole />
            <div>
              <strong>Your camera stays private</strong>
              <p>Video is processed in your browser. Align Posture saves scores, not images, and only after sign-in.</p>
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

function HomeView({
  onStart,
  onSave,
  isSignedIn,
}: {
  onStart: () => void;
  onSave: () => void;
  isSignedIn: boolean;
}) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="badge"><ShieldCheck /> Guest mode ready</div>
        <h1>Posture coaching you can try before you sign in.</h1>
        <p>Calibrate in under a minute, get real-time cues, and create an account only when you want your posture history saved.</p>
        <div className="hero-actions">
          <button className="button primary large" onClick={onStart}>Start free session <ArrowRight /></button>
          {!isSignedIn && <button className="button secondary large" onClick={onSave}>Save future progress</button>}
        </div>
        <div className="trust-row">
          <div><Check /> No login required to coach</div>
          <div><Check /> Camera processed locally</div>
          <div><Check /> Saved history requires account</div>
        </div>
      </div>
      <div className="hero-visual" aria-label="Posture coach preview">
        <div className="preview-window mage-card">
          <div className="preview-top"><Brand /><span className="live-dot">Live</span></div>
          <div className="silhouette">
            <span className="head" />
            <span className="body" />
            <span className="guide-line" />
          </div>
          <div className="preview-status">
            <span><Check /></span>
            <div><strong>Looking good</strong><p>Close to your neutral baseline</p></div>
            <b>12</b>
          </div>
        </div>
        <div className="floating-card"><Sparkles /><div><strong>Signed-out coaching</strong><span>Private trial mode</span></div></div>
      </div>
    </section>
  );
}

function SetupView({
  videoRef,
  camera,
  isSignedIn,
  onComplete,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  camera: ReturnType<typeof useCamera>;
  isSignedIn: boolean;
  onComplete: (profile: CalibrationComplete) => void;
}) {
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
          const profile = await api.completeCalibration(calibrationId);
          onComplete(profile);
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
    setError("Loading the private posture model...");
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
      <PageHeading
        eyebrow={isSignedIn ? "Saved setup" : "Guest setup"}
        title="Find your neutral posture."
        subtitle={isSignedIn ? "This calibration will be saved to your account." : "This temporary calibration lets you coach without an account. Sign in later to save progress."}
      />
      <div className="stepper">
        {["Camera", "Position", "Calibrate"].map((label, index) => {
          const current = ["camera", "position", "calibrate"].indexOf(step);
          return <div className={index <= current ? "current" : ""} key={label}><span>{index < current ? <Check /> : index + 1}</span>{label}</div>;
        })}
      </div>
      <div className="setup-grid">
        <CameraPanel videoRef={videoRef} cameraStatus={camera.status} onEnable={camera.start}>
          {step === "calibrate" && (
            <div className="calibration-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
              <strong>{progress}%</strong><span>Stay comfortable</span>
            </div>
          )}
        </CameraPanel>
        <aside className="instruction-card mage-card">
          {step === "camera" && <><p className="eyebrow">Step 1</p><h2>Turn on your camera</h2><p>Your video stays on this device. Only posture metrics are sent to the API.</p><button className="button primary full" onClick={camera.start}>Enable camera</button></>}
          {step === "position" && <><p className="eyebrow">Step 2</p><h2>Get comfortably in frame</h2><ul className="check-list"><li><Check /> Face and both shoulders are visible</li><li><Check /> Camera is near eye level</li><li><Check /> Sit as you normally work</li></ul><button className="button primary full" onClick={begin}>I'm ready to calibrate</button></>}
          {step === "calibrate" && <><p className="eyebrow">Step 3</p><h2>Hold your natural posture</h2><p>Keep looking toward the screen. This takes about six seconds.</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}% complete</strong></>}
          {error && <p className="error-message" role="alert">{error}</p>}
        </aside>
      </div>
    </div>
  );
}

function CoachView({
  videoRef,
  camera,
  isSignedIn,
  profileReady,
  guestProfileId,
  onSignInToSave,
  onRecalibrate,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  camera: ReturnType<typeof useCamera>;
  isSignedIn: boolean;
  profileReady: boolean;
  guestProfileId?: string;
  onSignInToSave: () => void;
  onRecalibrate: () => void;
}) {
  const [sessionId, setSessionId] = useState<string>();
  const [result, setResult] = useState<FrameResult>({});
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
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
        if (metrics) {
          setResult(await api.sendMetrics(
            metrics,
            undefined,
            isSignedIn ? sessionId : undefined,
            isSignedIn ? undefined : guestProfileId,
          ));
        } else {
          setResult({ state: "no_pose", message: "Move your upper body into view." });
        }
        setError("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Posture service connection paused.");
      } finally {
        busy.current = false;
      }
    }, 350);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(frames);
    };
  }, [guestProfileId, isSignedIn, sessionId, videoRef]);

  const start = async () => {
    if (!profileReady) {
      setError("Complete calibration before starting a coaching session.");
      return;
    }
    if (isSignedIn) {
      const session = await api.startSession();
      setSessionId(session.id);
    } else {
      setSessionId(`guest-${crypto.randomUUID?.() ?? Date.now()}`);
    }
    setSeconds(0);
    setResult({});
    setError("");
  };
  const stop = async () => {
    if (sessionId && isSignedIn) await api.completeSession(sessionId);
    setSessionId(undefined);
  };
  const state = result.state || "no_pose";
  const stateCopy = state === "good" ? "Looking good" : state === "warning" ? "A small reset may help" : state === "slouching" ? "Gently realign" : "Finding your posture";

  return (
    <div className="page coach-page">
      <div className="coach-heading">
        <PageHeading
          eyebrow={isSignedIn ? "Live coach" : "Guest coach"}
          title={sessionId ? stateCopy : "Ready when you are."}
          subtitle={sessionId ? (result.reasons?.[0] || result.message || "Sit naturally and keep your upper body in view.") : "Start a focused posture session whenever you settle in to work."}
        />
        <div className="session-time">{sessionId ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "00:00"}<span>Session time</span></div>
      </div>
      <div className="coach-grid">
        <CameraPanel videoRef={videoRef} cameraStatus={camera.status} onEnable={camera.start} state={state}>
          {sessionId && <div className={`live-score ${state}`}><span>Posture score</span><strong>{Math.round(result.score || 0)}</strong><small>Lower is better</small></div>}
        </CameraPanel>
        <aside className="coach-sidebar">
          <div className={`status-card ${state}`}><span className="status-orb">{state === "good" ? <Check /> : <Sparkles />}</span><div><p>Current posture</p><h3>{stateCopy}</h3></div></div>
          <div className="tip-card mage-card"><p className="eyebrow">A gentle cue</p><h3>{result.reasons?.[0] || "Relax your shoulders and settle in."}</h3><p>There is no perfect posture. Comfortable movement matters more than holding still.</p></div>
          {!isSignedIn && (
            <button className="save-panel mage-button" onClick={onSignInToSave}>
              <LockKeyhole /> Save future posture data
            </button>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
          {!sessionId ? <button className="button primary full large" onClick={start}>Start coaching <ArrowRight /></button> : <button className="button stop full large" onClick={stop}><Square /> End session</button>}
          <button className="text-button" onClick={onRecalibrate}><RefreshCw /> Recalibrate for a new setup</button>
        </aside>
      </div>
    </div>
  );
}

function LegalPage({ view }: { view: View }) {
  const document = legalDocuments[view as keyof typeof legalDocuments];
  if (!document) return null;
  return (
    <article className="page legal-page">
      <PageHeading eyebrow="Legal" title={document.title} subtitle={document.subtitle} />
      <div className="legal-card">
        <p className="legal-updated">Last updated: August 4, 2026</p>
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </div>
    </article>
  );
}

function Footer({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>Wellness posture coaching with local camera processing and account-gated saved history.</p>
      </div>
      <nav aria-label="Legal navigation">
        <button onClick={() => onNavigate("privacy")}><FileText /> Privacy</button>
        <button onClick={() => onNavigate("terms")}><FileText /> Terms</button>
        <button onClick={() => onNavigate("cookies")}><FileText /> Cookies</button>
        <button onClick={() => onNavigate("disclaimer")}><ShieldCheck /> Disclaimer</button>
        <button onClick={() => onNavigate("contact")}><Mail /> Contact</button>
        <a href="https://github.com/nilaycarleton/alignposture" target="_blank" rel="noreferrer">
          <Github /> GitHub
        </a>
      </nav>
    </footer>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>;
}

function isLegalView(view: View) {
  return ["privacy", "terms", "cookies", "disclaimer", "contact"].includes(view);
}

const legalDocuments = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "What Align Posture collects, why it is used, and when it is saved.",
    sections: [
      {
        heading: "Information we process",
        body: [
          "Guest coaching processes camera frames in your browser to estimate posture landmarks. Video frames are not saved by Align Posture.",
          "When you use the posture API, normalized posture metrics, calibration samples, posture scores, confidence values, timestamps, and session identifiers may be processed.",
          "If you create an account, Clerk handles authentication data such as account identifiers, email addresses, and sign-in provider details.",
        ],
      },
      {
        heading: "Guest mode",
        body: [
          "You can calibrate and receive live coaching without an account. Guest calibration profiles are temporary and are not written to the saved posture history database.",
          "Guest sessions are intended for trying the service. To save history, you must sign in or create an account.",
        ],
      },
      {
        heading: "Saved accounts",
        body: [
          "Signed-in users can save calibration profiles, session records, posture scores, posture states, confidence values, and timestamps.",
          "Saved posture history is used to show progress trends and improve your own coaching experience.",
        ],
      },
      {
        heading: "Retention and deletion",
        body: [
          "Guest calibration data is temporary server memory and may disappear when the service restarts.",
          "Saved posture history remains associated with your account until it is deleted or the service retention policy changes with notice.",
          "Contact support to request account or posture-history deletion.",
        ],
      },
      {
        heading: "Sharing",
        body: [
          "Align Posture does not sell posture data. Authentication is provided through Clerk, and hosting or infrastructure providers may process data as needed to operate the service.",
          "Information may be disclosed if required by law, to protect the service, or with your consent.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    subtitle: "The rules for using Align Posture.",
    sections: [
      {
        heading: "Use of the service",
        body: [
          "Align Posture is provided for personal wellness coaching and educational use.",
          "You are responsible for using the service in a safe environment and stopping if you feel discomfort.",
        ],
      },
      {
        heading: "Accounts",
        body: [
          "You do not need an account to try coaching. You need an account to save calibration data, posture sessions, and progress history.",
          "You are responsible for keeping your account access secure.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not misuse the API, attempt to access another user's data, interfere with the service, or submit unlawful content.",
          "The service may be changed, interrupted, or discontinued as the project evolves.",
        ],
      },
      {
        heading: "No guarantees",
        body: [
          "Posture analysis depends on camera quality, lighting, pose visibility, and calibration accuracy.",
          "The service is provided as-is without warranties to the fullest extent permitted by law.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Notice",
    subtitle: "How browser storage and authentication cookies support the app.",
    sections: [
      {
        heading: "Essential storage",
        body: [
          "Align Posture stores your theme preference in local browser storage.",
          "Clerk may use cookies and similar technologies to provide secure sign-in, session management, and account protection.",
        ],
      },
      {
        heading: "Analytics and marketing",
        body: [
          "This project should not add analytics, advertising, or tracking cookies without updating this notice and the Privacy Policy.",
          "You can control cookies through your browser settings, but blocking essential authentication cookies may prevent saved-account features from working.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Wellness Disclaimer",
    subtitle: "Align Posture is not medical care.",
    sections: [
      {
        heading: "Not a medical device",
        body: [
          "Align Posture is a wellness aid. It does not diagnose, treat, cure, prevent, or monitor a disease or medical condition.",
          "Posture feedback is generated from webcam-visible landmarks and may be inaccurate.",
        ],
      },
      {
        heading: "Health decisions",
        body: [
          "Do not ignore medical advice or delay care because of feedback from this service.",
          "Talk to a qualified professional if you have pain, injury, mobility limitations, or health concerns.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    subtitle: "Questions about privacy, accounts, or saved data.",
    sections: [
      {
        heading: "Support",
        body: [
          "For privacy, account, or deletion requests, contact the Align Posture project owner through the support channel listed with the deployed site or repository.",
          "Include the email address connected to your account when requesting access, correction, or deletion of saved posture data.",
        ],
      },
    ],
  },
};
