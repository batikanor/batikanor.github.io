const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const normalizeTopAlignedDestination = ({
  pageHeight,
  pageNumber,
  topFromPageTop,
}) => {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
    throw new Error("pageHeight must be a positive number");
  }

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error("pageNumber must be a positive integer");
  }

  if (!Number.isFinite(topFromPageTop)) {
    throw new Error("topFromPageTop must be a finite number");
  }

  const clampedTopFromPageTop = clamp(topFromPageTop, 0, pageHeight);

  return {
    pageNumber,
    magFactor: "FitH",
    top: pageHeight - clampedTopFromPageTop,
  };
};
