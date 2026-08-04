import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

const { authState, openSignInMock } = vi.hoisted(() => ({
  authState: { isSignedIn: true },
  openSignInMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
    isLoaded: true,
    isSignedIn: authState.isSignedIn,
  }),
  useClerk: () => ({ openSignIn: openSignInMock }),
  Show: ({ when, children }: any) => {
    if (when === "signed-in" && authState.isSignedIn) return children;
    if (when === "signed-out" && !authState.isSignedIn) return children;
    return null;
  },
  SignInButton: ({ children }: any) => children,
  SignUpButton: ({ children }: any) => children,
  UserButton: () => <div aria-label="User account" />,
}));

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: { getUserMedia: vi.fn() },
});
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ status: "ok", profile_ready: false }),
}) as any;

beforeEach(() => {
  authState.isSignedIn = true;
  openSignInMock.mockClear();
  window.localStorage.clear();
});

test("welcomes a first-time user with a clear action", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /posture coaching/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /start free session/i })).toBeInTheDocument();
  expect(await screen.findByText(/camera processed locally/i)).toBeInTheDocument();
});

test("lets signed-out users reach setup without opening sign in", () => {
  authState.isSignedIn = false;
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /start free session/i }));
  expect(screen.getByRole("heading", { name: /find your neutral posture/i })).toBeInTheDocument();
  expect(openSignInMock).not.toHaveBeenCalled();
});

test("asks signed-out users to sign in before progress", () => {
  authState.isSignedIn = false;
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^progress$/i }));
  expect(openSignInMock).toHaveBeenCalled();
});

test("persists the user's dark mode choice", () => {
  window.localStorage.setItem("align-theme", "light");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("align-theme")).toBe("dark");
});

test("opens and closes accessible help", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open help" }));
  expect(screen.getByRole("dialog", { name: "How can we help?" })).toBeInTheDocument();
  expect(screen.getByText("Your camera stays private")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close help" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
