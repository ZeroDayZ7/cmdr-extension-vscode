import * as assert from "node:assert";
import {
  compareSemanticVersions,
  parseSemanticVersion,
} from "../core/cli-manager.js";

suite("CMDR CLI update tests", () => {
  test("parses valid semantic versions", () => {
    assert.deepStrictEqual(parseSemanticVersion("2.1.7"), {
      major: 2,
      minor: 1,
      patch: 7,
      prerelease: [],
    });
    assert.deepStrictEqual(parseSemanticVersion("v2.1.7-rc.1"), {
      major: 2,
      minor: 1,
      patch: 7,
      prerelease: ["rc", "1"],
    });
  });

  test("rejects invalid semantic versions", () => {
    assert.strictEqual(parseSemanticVersion("latest"), undefined);
    assert.strictEqual(parseSemanticVersion("1.2"), undefined);
    assert.strictEqual(parseSemanticVersion("01.2.3"), undefined);
  });

  test("compares semantic versions and prereleases", () => {
    assert.strictEqual(compareSemanticVersions("2.0.0", "1.9.9"), 1);
    assert.strictEqual(compareSemanticVersions("1.0.0", "1.0.0"), 0);
    assert.strictEqual(compareSemanticVersions("1.0.0", "1.0.0-rc.1"), 1);
    assert.strictEqual(compareSemanticVersions("1.0.0-rc.1", "1.0.0-beta.2"), 1);
  });

  test("throws when comparing invalid versions", () => {
    assert.throws(
      () => compareSemanticVersions("latest", "1.0.0"),
      /Invalid semantic version/
    );
  });
});
