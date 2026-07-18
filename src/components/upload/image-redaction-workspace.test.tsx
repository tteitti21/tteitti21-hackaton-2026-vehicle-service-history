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
        <ImageRedactionWorkspace maxFiles={10} maxBytesPerFile={10} />
      </AnalysisSessionProvider>,
    );

    expect(
      screen.getByText(/Vain alla näkyvä peitetty esikatselu voidaan lähettää/),
    ).toBeVisible();
    expect(
      screen.getByText(/vastaanottava palveluntarjoaja on OpenAI/),
    ).toBeVisible();
    expect(screen.getByText(/Rekisterinumeroa tai VINiä ei tarvita/)).toBeVisible();

    fireEvent.change(screen.getByLabelText("Valitse kuvat"), {
      target: {
        files: [new File(["private"], "invoice.txt", { type: "text/plain" })],
      },
    });

    expect(
      await screen.findByText(/tuettuja tiedostomuotoja ovat JPG, PNG ja WebP/),
    ).toBeVisible();
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized images before browser decoding", async () => {
    const user = userEvent.setup();
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmapSpy);

    render(
      <AnalysisSessionProvider>
        <ImageRedactionWorkspace maxFiles={10} maxBytesPerFile={4} />
      </AnalysisSessionProvider>,
    );

    await user.upload(
      screen.getByLabelText("Valitse kuvat"),
      new File(["12345"], "large.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/tiedosto ylittää kokorajan/)).toBeVisible();
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });
});
