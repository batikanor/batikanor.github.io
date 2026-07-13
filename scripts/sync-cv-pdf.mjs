import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const GOOGLE_DOCUMENT_ID =
  "1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w";
const sourceUrl = `https://docs.google.com/document/d/${GOOGLE_DOCUMENT_ID}/export?format=pdf`;
const outputDirectory = path.join(process.cwd(), "public", "cv");
const outputPath = path.join(
  outputDirectory,
  "batikan-bora-ormanci-cv.pdf",
);
const temporaryPath = `${outputPath}.tmp`;

try {
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: { "user-agent": "batikanor.com CV sync" },
  });

  if (!response.ok) {
    throw new Error(`Google Docs returned HTTP ${response.status}`);
  }

  const pdf = Buffer.from(await response.arrayBuffer());
  const isPdf = pdf.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!isPdf) {
    throw new Error("Google Docs did not return a valid PDF");
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(temporaryPath, pdf);
  await rename(temporaryPath, outputPath);

  console.log(
    `Synced current CV PDF (${Math.round(pdf.length / 1024)} KB) to public/cv.`,
  );
} catch (error) {
  await rm(temporaryPath, { force: true });
  console.error(`Unable to sync CV PDF: ${error.message}`);
  process.exitCode = 1;
}
