import { act, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReplyComposer } from "../../components/messages/ReplyComposer";
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

  it("shows the character count when idle", () => {
    renderComposer();
    expect(screen.getByText("9/280")).toBeInTheDocument();
  });

  it("replaces the count with a posting status while sending", () => {
    renderComposer({ sending: true });
    expect(screen.queryByText("9/280")).toBeNull();
    expect(screen.getByText("Posting…")).toBeInTheDocument();
  });

  it("still reads 'Posting…' just before the wait becomes notable", () => {
    renderComposer({ sending: true, includesImage: true });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS - 1);
    });
    expect(screen.getByText("Posting…")).toBeInTheDocument();
  });

  it("explains the image renderer once the wait passes the threshold", () => {
    renderComposer({ sending: true, includesImage: true });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(screen.getByText("Still going, waking the image renderer…")).toBeInTheDocument();
  });

  it("does not blame the image renderer for a text-only reply", () => {
    renderComposer({ sending: true, includesImage: false });
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_HINT_MS);
    });
    expect(screen.getByText("Still going…")).toBeInTheDocument();
  });
});
