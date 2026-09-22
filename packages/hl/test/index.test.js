import { describe, expect, it } from "vitest";
import { assetIdFor, isHip3Coin, parseHip3Coin } from "../src/index.js";
describe("hl helpers", () => {
    it("assetId formula", () => {
        expect(assetIdFor(0, 0)).toBe(100000);
        expect(assetIdFor(1, 3)).toBe(110003);
        expect(assetIdFor(2, 25)).toBe(120025);
    });
    it("parses dex:coin", () => {
        expect(parseHip3Coin("xyz:TSLA")).toEqual({ dex: "xyz", base: "TSLA" });
        expect(isHip3Coin("xyz:TSLA")).toBe(true);
        expect(isHip3Coin("BTC")).toBe(false);
    });
});
