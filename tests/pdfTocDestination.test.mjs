import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTopAlignedDestination } from "../src/lib/pdfTocDestination.mjs";

test("converts top-based layout coordinates into FitH PDF destinations", () => {
  const destination = normalizeTopAlignedDestination({
    pageHeight: 297,
    pageNumber: 4,
    topFromPageTop: 20,
  });

  assert.deepEqual(destination, {
    pageNumber: 4,
    magFactor: "FitH",
    top: 277,
  });
});

test("clamps overshooting coordinates to the page bounds", () => {
  const destination = normalizeTopAlignedDestination({
    pageHeight: 297,
    pageNumber: 2,
    topFromPageTop: 999,
  });

  assert.deepEqual(destination, {
    pageNumber: 2,
    magFactor: "FitH",
    top: 0,
  });
});

test("rejects invalid destination inputs", () => {
  assert.throws(
    () =>
      normalizeTopAlignedDestination({
        pageHeight: 0,
        pageNumber: 1,
        topFromPageTop: 10,
      }),
    /pageHeight/
  );

  assert.throws(
    () =>
      normalizeTopAlignedDestination({
        pageHeight: 297,
        pageNumber: 0,
        topFromPageTop: 10,
      }),
    /pageNumber/
  );

  assert.throws(
    () =>
      normalizeTopAlignedDestination({
        pageHeight: 297,
        pageNumber: 1,
        topFromPageTop: Number.NaN,
      }),
    /topFromPageTop/
  );
});
