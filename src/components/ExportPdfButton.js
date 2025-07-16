"use client";

import { useState } from "react";
import { FaDownload } from "react-icons/fa";
import { contestsAndActivities as achievements } from "../data/contestsAndActivities";

// Completely redesigned PDF exporter with:
// • Clean text (no weird characters)
// • All links & QR codes in dedicated reference boxes
// • Modern, professional styling that never overlaps
export default function ExportPdfButton({ className = "" }) {
  const [loading, setLoading] = useState(false);

  const generatePDF = async () => {
    setLoading(true);

    try {
      // Dynamic imports (avoid bloating initial bundle)
      const jsPDF = (await import("jspdf")).default;
      const QRCode = (await import("qrcode")).default;

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
      let currentY = margin;

      /**********************  HELPERS  *************************/
      // Draw a full-width reference box with QR & link
      const addReferenceBox = async (url, label = "Reference") => {
        const qrSize = 20;
        const leftX = margin + qrSize + 10;

        // Prepare label lines
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        const maxTextWidth = pageWidth - 2 * margin - qrSize - 15;
        const labelLines = pdf.splitTextToSize(label, maxTextWidth);

        // Prepare URL lines (truncate only if still too long after wrapping)
        pdf.setFontSize(8);
        const splitUrlLines = pdf.splitTextToSize(url, maxTextWidth);
        let urlLines = splitUrlLines;
        if (urlLines.length > 2) {
          // truncate to max 2 lines with ellipsis
          const concat = splitUrlLines.join(" ");
          let display = concat;
          while (
            pdf.getTextWidth(display) > maxTextWidth &&
            display.length > 0
          ) {
            display = display.slice(0, -1);
          }
          urlLines = [display + "..."]; // single truncated line
        }

        const lineHeight = 4;
        const textHeight =
          (labelLines.length + urlLines.length) * lineHeight + 6; // padding
        const boxHeight = Math.max(qrSize + 8, textHeight);

        // Page break if needed
        if (currentY + boxHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        // Draw box
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.rect(margin, currentY, pageWidth - 2 * margin, boxHeight, "FD");

        // QR code
        try {
          const qrData = await QRCode.toDataURL(url, {
            width: 160,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          pdf.addImage(qrData, "PNG", margin + 5, currentY + 4, qrSize, qrSize);
        } catch (e) {
          console.error("QR generation error", e);
        }

        // Render label lines
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(71, 85, 105);
        let textY = currentY + 8;
        labelLines.forEach((line) => {
          pdf.text(line, leftX, textY);
          textY += lineHeight;
        });

        // Render URL lines (first line clickable)
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(59, 130, 246);

        urlLines.forEach((line, idx) => {
          if (idx === 0) {
            pdf.textWithLink(line, leftX, textY, { url });
          } else {
            pdf.text(line, leftX, textY);
          }
          textY += lineHeight;
        });

        // Reset color back to black for following content
        pdf.setTextColor(0, 0, 0);

        currentY += boxHeight + 5;
      };

      // Clean description text (remove URLs, placeholders, non-ASCII)
      const cleanText = (raw) => {
        return raw
          .replace(/\{\{gdrive_embed\[\d+\]\}\}/g, "")
          .replace(/https?:\/\/(?:[^\s]|\n)+/g, "") // remove multi-line URLs
          .replace(/[^ -~]+/g, "") // strip non-ASCII
          .replace(/\s+/g, " ")
          .trim();
      };

      // Sanitize text (replace smart quotes/dashes & strip non-ASCII)
      const sanitizeText = (str = "") => {
        return str
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/[–—]/g, "-")
          .replace(/[^\x00-\x7F\n]+/g, "") // keep newlines
          .trimEnd();
      };

      // Render a paragraph preserving newlines
      const renderParagraph = (paragraph, fontSize = 9) => {
        const lines = pdf.splitTextToSize(paragraph, pageWidth - 2 * margin);
        renderLines(lines, fontSize);
        currentY += 4; // extra space between paragraphs
      };

      // Process description with placeholders inline
      const processDescription = async (desc, embeds) => {
        const regex = /\{\{gdrive_embed\[(\d+)\]\}\}/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(desc))) {
          const textBefore = desc.slice(lastIndex, match.index);
          if (textBefore) {
            textBefore.split(/\n+/).forEach((p) => {
              const clean = sanitizeText(p);
              if (clean) renderParagraph(clean);
            });
          }
          const idx = parseInt(match[1]);
          const embed = embeds?.[idx];
          if (embed) {
            const cap = sanitizeText(embed.abovePhotoCaption || "Media file");
            await addReferenceBox(embed.url || embed, cap);
          }
          lastIndex = match.index + match[0].length;
        }
        const remaining = desc.slice(lastIndex);
        if (remaining) {
          remaining.split(/\n+/).forEach((p) => {
            const clean = sanitizeText(p);
            if (clean) renderParagraph(clean);
          });
        }
      };

      // Helper to render lines with automatic page break
      const renderLines = (lines, fontSize) => {
        const lineHeight = fontSize <= 9 ? 4 : 5;
        lines.forEach((line) => {
          if (currentY > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          pdf.text(line, margin, currentY);
          currentY += lineHeight;
        });
      };
      /**********************************************************/

      /**********************  HEADER  **************************/
      pdf.setFillColor(37, 99, 235); // Brand blue
      pdf.rect(0, 0, pageWidth, 50, "F");

      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Summary Report of Batikan's Achievements", margin, 20);

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "Professional portfolio with interactive references",
        margin,
        35
      );

      currentY = 60;
      await addReferenceBox(
        "https://batikanor.com",
        "This is a PDF summary of my achievements listed on my homepage. Reach out to be through batikanor@gmail.com if you'd like to know more about any of them."
      );
      /**********************************************************/

      /********************  ACHIEVEMENTS  **********************/
      const valid = achievements.filter((a) => a && a.title);

      for (const achievement of valid) {
        // Title
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(achievement.title, margin, currentY);
        currentY += 10;

        // Date
        if (achievement.date) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(107, 114, 128);
          pdf.text(achievement.date, margin, currentY);
          currentY += 8;
        }

        // Short description
        if (achievement.shortDescription) {
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          const lines = pdf.splitTextToSize(
            sanitizeText(achievement.shortDescription),
            pageWidth - 2 * margin
          );
          renderLines(lines, 10);
          currentY += 6;
        }

        // Long description (cleaned)
        if (achievement.longDescription) {
          pdf.setFontSize(9);
          pdf.setTextColor(0, 0, 0);
          await processDescription(
            achievement.longDescription,
            achievement.gdrive_embed
          );
          currentY += 4;
        }

        // Technologies
        if (achievement.technologies?.length) {
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "bold");
          pdf.text("Technologies:", margin, currentY);
          pdf.setFont("helvetica", "normal");
          const tech = achievement.technologies.join(" • ");
          const techLines = pdf.splitTextToSize(tech, pageWidth - 2 * margin);
          pdf.text(techLines, margin + 25, currentY);
          currentY += techLines.length * 4 + 10;
        }

        // Gather all links for references
        const refs = [];

        const urlRegex = /https?:\/\/(?:[^\s]|\n)+/g;
        const rawDesc = achievement.longDescription || "";
        const foundUrls = rawDesc.match(urlRegex) || [];
        foundUrls.forEach((u) => {
          refs.push({ url: u, label: "Link from description" });
        });

        // Embedded media links with captions
        achievement.gdrive_embed?.forEach((embed) => {
          if (!embed) return;
          const url = typeof embed === "string" ? embed : embed.url;
          if (!url) return;
          const caption = sanitizeText(embed.abovePhotoCaption || "Media file");
          refs.push({ url, label: caption });
        });

        // Regular links with labels
        achievement.links?.forEach((lnk) => {
          if (!lnk) return;
          if (typeof lnk === "string") {
            refs.push({ url: lnk, label: sanitizeText(lnk) });
          } else if (lnk.url) {
            refs.push({
              url: lnk.url,
              label: sanitizeText(lnk.label || lnk.url),
            });
          }
        });

        if (refs.length) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(0, 0, 0);
          pdf.text("References:", margin, currentY);
          currentY += 7;

          for (const r of refs) {
            await addReferenceBox(r.url, r.label);
          }
        }

        currentY += 15; // space before next achievement

        // Page break if near bottom
        if (currentY > pageHeight - 60) {
          pdf.addPage();
          currentY = margin;
        }
      }
      /**********************************************************/

      pdf.save("batikan-achievements-summary.pdf");
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={loading}
      className={`btn flex items-center gap-3 ${className}`}
    >
      <FaDownload className="text-sm" />
      {loading
        ? "Generating PDF..."
        : "Download summary of achievements as PDF"}
    </button>
  );
}
