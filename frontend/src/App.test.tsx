import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("test-token"),
    isLoaded: true,
    isSignedIn: true,
  }),
  useClerk: () => ({ openSignIn: vi.fn() }),
  Show: ({ when, children }: any) => when === "signed-in" ? children : null,
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

test("welcomes a first-time user with a clear action", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /better posture/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /start a session/i })).toBeInTheDocument();
  expect(await screen.findByText(/free account/i)).toBeInTheDocument();
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
