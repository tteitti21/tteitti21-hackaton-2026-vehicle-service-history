import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisSessionProvider } from "@/components/session/analysis-session-provider";

import { ImageRedactionWorkspace } from "./image-redaction-workspace";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageRedactionWorkspace", () => {
  it("shows the privacy boundary and does not decode unsupported files", async () => {
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmapSpy);

    render(
      <AnalysisSessionProvider>
        <ImageRedactionWorkspace
          maxFiles={10}
          maxBytesPerFile={10}
          maxRequestBytes={110}
        />
      </AnalysisSessionProvider>,
    );

    expect(
      screen.getByText(/Only the sanitized preview shown below can be submitted/),
    ).toBeVisible();
    expect(
      screen.getByText(/provider receiving the sanitized image is OpenAI/),
    ).toBeVisible();
    expect(screen.getByText(/registration number or VIN is not needed/)).toBeVisible();

    fireEvent.change(screen.getByLabelText("Select images"), {
      target: {
        files: [new File(["private"], "invoice.txt", { type: "text/plain" })],
      },
    });

    expect(
      await screen.findByText(/supported file formats are JPG, PNG, and WebP/),
    ).toBeVisible();
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized images before browser decoding", async () => {
    const user = userEvent.setup();
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmapSpy);

    render(
      <AnalysisSessionProvider>
        <ImageRedactionWorkspace
          maxFiles={10}
          maxBytesPerFile={4}
          maxRequestBytes={44}
        />
      </AnalysisSessionProvider>,
    );

    await user.upload(
      screen.getByLabelText("Select images"),
      new File(["12345"], "large.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/file exceeds the .* size limit/)).toBeVisible();
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });
});
