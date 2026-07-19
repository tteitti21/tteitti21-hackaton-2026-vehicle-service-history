import { describe, expect, it } from "vitest";

import { maintenanceResearchRequestFixture } from "@/test/maintenance-research-fixture";
import {
  MAX_MAINTENANCE_RESEARCH_REQUEST_BYTES,
  parseMaintenanceResearchRequest,
} from "./maintenance-research-request";

describe("parseMaintenanceResearchRequest", () => {
  it("accepts the strict Phase 6 contract", async () => {
    await expect(
      parseMaintenanceResearchRequest(createRequest(maintenanceResearchRequestFixture)),
    ).resolves.toEqual(maintenanceResearchRequestFixture);
  });

  it("rejects unknown sensitive fields and duplicate component codes", async () => {
    await expect(
      parseMaintenanceResearchRequest(
        createRequest({
          ...maintenanceResearchRequestFixture,
          registrationNumber: "SECRET-123",
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

    await expect(
      parseMaintenanceResearchRequest(
        createRequest({
          ...maintenanceResearchRequestFixture,
          components: [
            maintenanceResearchRequestFixture.components[0],
            maintenanceResearchRequestFixture.components[0],
          ],
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
  });

  it("rejects non-JSON and oversized requests", async () => {
    await expect(
      parseMaintenanceResearchRequest(
        new Request("http://localhost/api/research", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({
      status: 415,
      code: "unsupported_media_type",
    });

    await expect(
      parseMaintenanceResearchRequest(
        new Request("http://localhost/api/research", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(
              MAX_MAINTENANCE_RESEARCH_REQUEST_BYTES + 1,
            ),
          },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });
});

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
}
