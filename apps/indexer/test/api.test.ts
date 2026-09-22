import { describe, expect, it } from "vitest";
import { buildServer } from "../src/index.js";
describe("indexer api", () => {
  it("GET /v1/markets returns rows", async () => {
    const app = await buildServer();
    const r = await app.inject({ method: "GET", url: "/v1/markets" });
    expect(r.statusCode).toBe(200);
    const j = r.json() as unknown[];
    expect(Array.isArray(j)).toBe(true);
    expect(j.length).toBeGreaterThan(0);
  });
  it("healthz ok", async () => {
    const app = await buildServer();
    const r = await app.inject({ method: "GET", url: "/healthz" });
    expect(r.json()).toMatchObject({ ok: true });
  });
});