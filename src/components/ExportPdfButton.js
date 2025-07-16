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
      const toc = [];
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
      let currentY = margin;

      // ---------------------------------------------------------------------------
      // Gradient color helper: pick a color between purple and orange based on a
      // deterministic hash of the location string so each city/country pair always
      // gets the same hue.
      const locationColorCache = {};
      const startColor = [139, 92, 246]; // purple (tailwind violet-500)
      const endColor = [245, 158, 11]; // orange (tailwind amber-400)
      const getLocationColor = (loc = "") => {
        if (locationColorCache[loc]) return locationColorCache[loc];
        // Simple deterministic hash → 0…1
        let hash = 0;
        for (let i = 0; i < loc.length; i++) {
          hash = (hash * 31 + loc.charCodeAt(i)) & 0xffffffff;
        }
        const t = (hash >>> 0) / 0xffffffff;
        const color = startColor.map((s, idx) =>
          Math.round(s + (endColor[idx] - s) * t)
        );
        locationColorCache[loc] = color;
        return color; // [r, g, b]
      };
      // ---------------------------------------------------------------------------

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
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(paragraph, pageWidth - 2 * margin);
        renderLines(lines, fontSize);
        currentY += 4; // extra space between paragraphs
      };

      // Process description with placeholders inline
      const processDescription = async (desc, embeds, usedSet) => {
        const regex =
          /\{\{gdrive_embed\[(\d+)\]\}\}|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
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
          if (match[1] !== undefined) {
            // embed placeholder
            const idx = parseInt(match[1]);
            const embed = embeds?.[idx];
            if (embed) {
              const cap = sanitizeText(embed.abovePhotoCaption || "Media file");
              await addReferenceBox(embed.url || embed, cap);
              usedSet.add(idx);
            }
          } else if (match[2] !== undefined && match[3] !== undefined) {
            // markdown link [label](url)
            const label = sanitizeText(match[2]);
            const url = match[3];
            await addReferenceBox(url, label);
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
        pdf.setFontSize(fontSize);
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

      // ---------------------------------------------------------------------------
      // Helper to render an achievement header with orange title + small QR code
      const renderAchievementHeader = async (ach) => {
        const qrSize = 18; // small QR
        const paddingX = 5;
        const paddingY = 4;
        const maxTextWidth = pageWidth - 2 * margin - qrSize - paddingX * 3;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        const titleLines = pdf.splitTextToSize(ach.title, maxTextWidth);
        const lineHeight = 8;
        const contentHeight = titleLines.length * lineHeight;
        const boxHeight = Math.max(
          contentHeight + paddingY * 2,
          qrSize + paddingY * 2
        );

        // Page break if needed
        if (currentY + boxHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        // Box border for nice styling
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.4);
        pdf.rect(margin, currentY, pageWidth - 2 * margin, boxHeight, "S");

        // Title text in orange theme color
        pdf.setTextColor(245, 158, 11);
        let textY = currentY + paddingY + lineHeight - 2; // slight vertical align tweak
        titleLines.forEach((line) => {
          pdf.text(line, margin + paddingX, textY);
          textY += lineHeight;
        });

        // Coordinates for QR placement
        const qrX = pageWidth - margin - qrSize - paddingX;
        const qrY = currentY + (boxHeight - qrSize) / 2;

        // Small label below QR with clickable blue domain
        const prefixTxt = "view on ";
        const domainTxt = "batikanor.com";
        pdf.setFontSize(7);
        const prefixW = pdf.getTextWidth(prefixTxt);
        const domainW = pdf.getTextWidth(domainTxt);
        const totalW = prefixW + domainW;
        const baseX = qrX + (qrSize - totalW) / 2;
        const baseY = qrY + qrSize + 3;

        // draw prefix in black
        pdf.setTextColor(0, 0, 0);
        pdf.text(prefixTxt, baseX, baseY);

        // draw domain in blue with link
        if (ach.slug) {
          const url = `https://batikanor.com/#${ach.slug}`;
          pdf.setTextColor(59, 130, 246);
          pdf.textWithLink(domainTxt, baseX + prefixW, baseY, { url });
        } else {
          pdf.setTextColor(59, 130, 246);
          pdf.text(domainTxt, baseX + prefixW, baseY);
        }

        // reset color
        pdf.setTextColor(0, 0, 0);

        // QR code on the right (link to homepage achievement section)
        if (ach.slug) {
          try {
            const url = `https://batikanor.com/#${ach.slug}`;
            const qrData = await QRCode.toDataURL(url, {
              width: 160,
              margin: 1,
              errorCorrectionLevel: "M",
            });
            pdf.addImage(
              "PNG" === "PNG" ? qrData : qrData,
              "PNG",
              qrX,
              qrY,
              qrSize,
              qrSize
            );
          } catch (err) {
            console.error("QR generation error", err);
          }
        }

        currentY += boxHeight + 6; // space after header
      };
      // ---------------------------------------------------------------------------
      /**********************************************************/

      /**********************  HEADER  **************************/
      pdf.setFillColor(245, 158, 11); // Accent amber
      pdf.rect(0, 0, pageWidth, 20, "F");

      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Summary Report of Batikan's Achievements", margin, 10);

      const headerHeight = 15;
      currentY = headerHeight;

      await addReferenceBox(
        "https://batikanor.com",
        "This is a PDF summary of my achievements listed on my homepage. For a more interactive experience, visit my homepage using a web browser."
      );

      // store Y where TOC should start later
      const tocStartY = currentY;

      // Start achievements on a new page for clean layout
      pdf.addPage();
      currentY = margin;
      /**********************************************************/

      /********************  ACHIEVEMENTS  **********************/
      const valid = achievements.filter((a) => a && a.title);

      for (const achievement of valid) {
        // record toc entry
        const locationStr = achievement.mapData
          ? `${achievement.mapData.city}, ${achievement.mapData.country}`
          : "";
        toc.push({
          title: achievement.title,
          page: pdf.internal.getCurrentPageInfo().pageNumber,
          y: currentY,
          date: achievement.date,
          location: locationStr,
        });

        // Styled header with title + QR
        await renderAchievementHeader(achievement);

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
        const usedEmbedIdx = new Set();
        if (achievement.longDescription) {
          await processDescription(
            achievement.longDescription,
            achievement.gdrive_embed,
            usedEmbedIdx
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

        // no generic 'link from description' refs; markdown links handled inline

        // Embedded media links with captions
        achievement.gdrive_embed?.forEach((embed, idx) => {
          if (usedEmbedIdx.has(idx)) return; // already placed inline
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

      /* -------- Insert Table of Contents pages right after cover -------- */
      let pagesInserted = 0;
      const addTocPage = () => {
        pdf.insertPage(2 + pagesInserted); // after cover + previous TOC pages
        pdf.setPage(2 + pagesInserted);
        pagesInserted += 1;
        return margin;
      };

      // start TOC on cover page right after reference box
      pdf.setPage(1);
      let tocY = tocStartY + 5;

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Table of Contents", margin, tocY);
      tocY += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      toc.forEach((entry, idx) => {
        // if near bottom, create new TOC page contiguous
        if (tocY > pageHeight - margin - 20) {
          tocY = addTocPage();
        }

        pdf.setTextColor(0, 0, 0);
        pdf.text(`${idx + 1}.`, margin, tocY);

        const maxW = pageWidth - 2 * margin - 20;
        const lines = pdf.splitTextToSize(entry.title, maxW);
        lines.forEach((line, i) => {
          if (i === 0) {
            pdf.textWithLink(line, margin + 12, tocY, {
              pageNumber: entry.page + pagesInserted,
              top: entry.y,
            });
          } else {
            pdf.text(line, margin + 12, tocY);
          }
          tocY += 5;
        });

        // location/date on same line if space else wrap
        const loc = entry.location || "";
        const date = entry.date || "";
        if (loc || date) {
          const baseX = margin + 20;
          const locWidth = pdf.getTextWidth(loc);
          const dateWidth = pdf.getTextWidth(date);
          if (locWidth + dateWidth + 6 <= maxW) {
            if (loc) {
              const [lr, lg, lb] = getLocationColor(loc);
              pdf.setTextColor(lr, lg, lb);
              pdf.text(loc, baseX, tocY);
            }
            if (date) {
              pdf.setTextColor(59, 130, 246);
              pdf.text(date, baseX + locWidth + 6, tocY);
            }
            tocY += 5;
          } else {
            if (loc) {
              const [lr, lg, lb] = getLocationColor(loc);
              pdf.setTextColor(lr, lg, lb);
              pdf.text(loc, baseX, tocY);
              tocY += 5;
            }
            if (date) {
              pdf.setTextColor(59, 130, 246);
              pdf.text(date, baseX, tocY);
              tocY += 5;
            }
          }
        }

        tocY += 2;
      });

      pdf.setTextColor(0, 0, 0);
      pdf.setPage(pdf.getNumberOfPages());
      /* ------------------------------------------------------------------ */

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
