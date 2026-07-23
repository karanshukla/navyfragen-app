import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as authService from "../../api/authService";
import Customise from "../../pages/Customise";
import { renderWithProviders } from "../testUtils";

vi.mock("../../api/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/authService")>();
  return { ...actual, useSession: vi.fn() };
});

const mockUseSession = vi.mocked(authService.useSession);

describe("Customise page (design placeholder)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows auth error when user is not logged in", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: false },
      isLoading: false,
    } as any);
    renderWithProviders(<Customise />);
    expect(screen.getByText(/cannot access this page without logging in/i)).toBeInTheDocument();
  });

  it("renders the grouped sections for a logged-in user", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
      isLoading: false,
    } as any);
    renderWithProviders(<Customise />);

    expect(screen.getByRole("heading", { name: /customise/i })).toBeInTheDocument();
    expect(screen.getByText(/design preview/i)).toBeInTheDocument();
    // Section eyebrows
    expect(screen.getByText(/your public profile/i)).toBeInTheDocument();
    expect(screen.getByText(/message intake/i)).toBeInTheDocument();
    expect(screen.getByText(/^notifications$/i)).toBeInTheDocument();
    // Placeholder cards
    expect(screen.getByText(/profile prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/message language/i)).toBeInTheDocument();
    expect(screen.getByText(/^inbox$/i)).toBeInTheDocument();
    expect(screen.getByText(/profanity filter/i)).toBeInTheDocument();
    expect(screen.getByText(/what sends a push/i)).toBeInTheDocument();
  });

  it("keeps every control disabled (non-functional placeholder)", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
      isLoading: false,
    } as any);
    renderWithProviders(<Customise />);

    const promptInput = screen.getByLabelText(/profile prompt/i) as HTMLInputElement;
    expect(promptInput).toBeDisabled();
    const acceptingSwitch = screen.getByLabelText(/accepting messages/i) as HTMLInputElement;
    expect(acceptingSwitch).toBeDisabled();
  });

  it("renders correctly in dark mode", () => {
    mockUseSession.mockReturnValue({
      data: { isLoggedIn: true, profile: { handle: "karan.bsky.social" } },
      isLoading: false,
    } as any);
    renderWithProviders(<Customise />, { colorScheme: "dark" });
    expect(screen.getByRole("heading", { name: /customise/i })).toBeInTheDocument();
  });
});
