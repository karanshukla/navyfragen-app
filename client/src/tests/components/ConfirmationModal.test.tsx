import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { renderWithProviders } from "../testUtils";
import { ConfirmationModal } from "../../components/ConfirmationModal";

describe("ConfirmationModal", () => {
  it("renders title and message", () => {
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item"
        message="Are you sure?"
      />
    );
    expect(screen.getByText("Delete item")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("shows default confirm/cancel labels when not provided", () => {
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        message="M"
      />
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows custom confirm/cancel labels when provided", () => {
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        message="M"
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
      />
    );
    expect(screen.getByText("Yes, delete")).toBeInTheDocument();
    expect(screen.getByText("No, keep")).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={onClose}
        onConfirm={vi.fn()}
        title="T"
        message="M"
      />
    );
    await userEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="T"
        message="M"
      />
    );
    await userEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables cancel button when loading is true", () => {
    renderWithProviders(
      <ConfirmationModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="T"
        message="M"
        loading
      />
    );
    const cancelBtn = screen.getByText("Cancel").closest("button");
    expect(cancelBtn).toBeDisabled();
  });
});
