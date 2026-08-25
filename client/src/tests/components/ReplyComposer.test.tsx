import { act, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReplyComposer } from "../../components/messages/ReplyComposer";
import { en } from "../../lib/i18n/en";
import { SLOW_REQUEST_HINT_MS } from "../../lib/useSlowRequestHint";
import { renderWithProviders } from "../testUtils";

function renderComposer(overrides: Partial<React.ComponentProps<typeof ReplyComposer>> = {}) {
  return renderWithProviders(
    <ReplyComposer
      value="an answer"
      onChange={vi.fn()}
      characterLimit={280}
      onSend={vi.fn()}
      onCancel={vi.fn()}
      sending={false}
      blocked={false}
      inThread={false}
      includesImage={false}
      awaitingRender={false}
      textareaRef={React.createRef<HTMLTextAreaElement>()}
      {...overrides}
    />
  );
}

describe("ReplyComposer status line", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts edits to the draft before the reply is sent", () => {
    renderComposer();
    expect(
      screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
    ).not.toHaveAttribute("readonly");
  });

  it("refuses edits to the draft while the reply is in flight", () => {
    // The send captured this text when it was committed, so an edit landing
    // now would post the old draft while showing the new one.
    renderComposer({ sending: true });
    expect(
      screen.getByRole("textbox", { name: en.replyComposer.responseAriaLabel })
    ).toHaveAttribute("readonly");
  });

  it("shows the character count when idle", () => {
    renderComposer();
    expect(screen.getByText("9/280")).toBeInTheDocument();
  });

  it("replaces the count with a posting status while sending", () => {
    renderComposer({ sending: true });
    expect(screen.queryByText("9/280")).toBeNull();
    expect(screen.getByText(en.replyComposer.posting)).toBeInTheDocument();
  });

  it("still reads 'Posting…' just before the wait becomes notable", () => {
    renderComposer({ sending: true, includesImage: true });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS - 1);
    });
    expect(screen.getByText(en.replyComposer.posting)).toBeInTheDocument();
  });

  it("explains the image renderer once the wait passes the threshold", () => {
    renderComposer({ sending: true, includesImage: true });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(screen.getByText(en.replyComposer.stillGoingWakingRenderer)).toBeInTheDocument();
  });

  it("does not blame the image renderer for a text-only reply", () => {
    renderComposer({ sending: true, includesImage: false });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(screen.getByText(en.replyComposer.stillGoing)).toBeInTheDocument();
  });

  it("says the send is waiting on the image while the render is still running", () => {
    renderComposer({ sending: true, includesImage: true, awaitingRender: true });
    expect(screen.getByText(en.replyComposer.renderingImage)).toBeInTheDocument();
  });

  it("keeps blaming the render, not the post, once the wait becomes notable", () => {
    renderComposer({ sending: true, includesImage: true, awaitingRender: true });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(screen.getByText(en.replyComposer.stillRenderingImage)).toBeInTheDocument();
  });
});
