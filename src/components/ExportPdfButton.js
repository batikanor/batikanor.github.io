"use client";

import { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";
import { contestsAndActivities as achievements } from "../data/contestsAndActivities";

// Completely redesigned PDF exporter with:
// • Clean text (no weird characters)
// • All links & QR codes in dedicated reference boxes
// • Modern, professional styling that never overlaps
export default function ExportPdfButton({
  className = "",
  autoStart = false,
  hideWhenAuto = true,
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null); // null when inactive, 0..1 when active
  const [includeImages, setIncludeImages] = useState(true);
  const [compressPdf, setCompressPdf] = useState(true);
  const [compressionStrength, setCompressionStrength] = useState(0.1); // default 10% compression strength
  const [imageScale, setImageScale] = useState(1); // 0.2 .. 1 (as fraction of default width)

  // Preview state for compression demo image
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewSize, setPreviewSize] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const PREVIEW_BASE = 560; // px - approximates PDF embed width at 100%
  const previewImgPath = "/photos/batikan/batikan-pamukkale.jpeg";

  // Generate compression preview whenever strength changes or imageScale toggles
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(previewImgPath); // sample image
        const blob = await resp.blob();

        const imgEl = await new Promise((res, rej) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            res(img);
          };
          img.onerror = rej;
          img.src = url;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxW = PREVIEW_BASE * imageScale;
        const scale = maxW / imgEl.width;
        canvas.width = maxW;
        canvas.height = imgEl.height * scale;
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

        const quality = compressPdf ? 1 - compressionStrength : 1;
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        setPreviewSrc(dataUrl);
        const approxKB = Math.round((dataUrl.length * 0.75) / 1024);
        setPreviewSize(approxKB);
      } catch (e) {
        console.error("Preview generation failed", e);
      }
    })();
  }, [compressionStrength, compressPdf, imageScale]);

  const generatePDF = async () => {
    setLoading(true);
    setProgress(0);

    try {
      // Dynamic imports (avoid bloating initial bundle)
      const jsPDF = (await import("jspdf")).default;
      const QRCode = (await import("qrcode")).default;

      const pdf = new jsPDF({ compress: compressPdf });
      const toc = [];
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
      let currentY = margin;

      // expose flags to inner helpers via closure
      const shouldEmbedImages = includeImages;

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

      // Helper: convert a Google Drive share/view link to direct download URL
      const gDriveToDirectUrl = (url) => {
        try {
          const m = url.match(/\/d\/([^/]+)\//);
          if (m && m[1]) {
            return `https://drive.google.com/uc?export=download&id=${m[1]}`;
          }
        } catch (_) {}
        return url;
      };
      // ---------------------------------------------------------------------------

      /**********************  HELPERS  *************************/
      // Draw a full-width reference box with QR & link (now supports inline image)
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
        const baseBoxHeight = Math.max(qrSize + 8, textHeight);

        /* ------------ Attempt to fetch Google Drive image --------------- */
        let imgData = null;
        let imgDisplayW = 0;
        let imgDisplayH = 0;
        if (shouldEmbedImages && url.includes("drive.google.com")) {
          try {
            const directUrl = gDriveToDirectUrl(url);
            const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(
              directUrl
            )}`;
            const resp = await fetch(proxied);
            if (!resp.ok) throw new Error("proxy fetch fail");
            const blob = await resp.blob();

            // Convert blob -> DataURL
            const dataUrl = await new Promise((res, rej) => {
              const fr = new FileReader();
              fr.onload = () => res(fr.result);
              fr.onerror = rej;
              fr.readAsDataURL(blob);
            });

            // Load into Image to determine dimensions
            const imgEl = await new Promise((res, rej) => {
              const img = new Image();
              img.onload = () => res(img);
              img.onerror = rej;
              img.src = dataUrl;
            });

            // Pick format based on original blob type or fallback to JPEG
            let baseFormat = "JPEG";
            if (blob.type.includes("png")) baseFormat = "PNG";
            else if (blob.type.includes("jpeg") || blob.type.includes("jpg"))
              baseFormat = "JPEG";

            let finalDataUrl = dataUrl;
            let finalFormat = baseFormat;

            // If compression requested, downscale & convert to JPEG quality 0.6
            if (compressPdf) {
              try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const baseW = Math.min(imgEl.naturalWidth, 800);
                const targetW = baseW * imageScale;
                const scale = targetW / imgEl.naturalWidth;
                canvas.width = targetW;
                canvas.height = imgEl.naturalHeight * scale;
                ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
                finalDataUrl = canvas.toDataURL(
                  "image/jpeg",
                  1 - compressionStrength
                );
                finalFormat = "JPEG";
              } catch (cErr) {
                console.warn("Image compression failed", cErr);
              }
            }

            imgData = { data: finalDataUrl, format: finalFormat };
            const availW = (pageWidth - 2 * margin - 10) * imageScale;
            imgDisplayW = availW;
            imgDisplayH = (imgEl.naturalHeight / imgEl.naturalWidth) * availW;
          } catch (err) {
            console.error("Failed to embed Drive image", err);
          }
        }
        /* ----------------------------------------------------------------- */

        const boxHeight = baseBoxHeight + (imgData ? imgDisplayH + 6 : 0); // +padding if image present

        // Page break if needed
        if (currentY + boxHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        // Draw box background/border
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

        // Draw image (below text section) if available
        if (imgData) {
          const imgX = margin + 5; // small inner padding
          const imgY = currentY + baseBoxHeight + 4; // spacing after text
          pdf.addImage(
            imgData.data,
            imgData.format,
            imgX,
            imgY,
            imgDisplayW,
            imgDisplayH
          );
        }

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

      // Helper to render an inline clickable link styled like normal text
      const renderInlineLink = (label, url, fontSize = 9) => {
        pdf.setFontSize(fontSize);
        const lineHeight = fontSize <= 9 ? 4 : 5;
        const maxWidth = pageWidth - 2 * margin;
        // Split the label in case it is long
        const lines = pdf.splitTextToSize(label, maxWidth);

        // Use blue for the clickable link text
        pdf.setTextColor(59, 130, 246);
        lines.forEach((line, idx) => {
          if (currentY > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          if (idx === 0) {
            pdf.textWithLink(line, margin, currentY, { url });
          } else {
            pdf.text(line, margin, currentY);
          }
          currentY += lineHeight;
        });

        // Reset text color back to black
        pdf.setTextColor(0, 0, 0);
      };

      // --- Rich description processor without random newlines ------------------
      const processDescription = async (desc, embeds, usedSet) => {
        // Tokenize text into plain, link, embed, and newline tokens
        const tokRegex =
          /\{\{gdrive_embed\[(\d+)\]\}\}|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\n+/g;
        let last = 0;
        const tokens = [];
        let m;
        while ((m = tokRegex.exec(desc))) {
          if (m.index > last) {
            tokens.push({ type: "text", text: desc.slice(last, m.index) });
          }
          if (m[1] !== undefined) {
            tokens.push({ type: "embed", idx: parseInt(m[1]) });
          } else if (m[2] !== undefined) {
            tokens.push({ type: "link", label: m[2], url: m[3] });
          } else {
            tokens.push({ type: "newline" });
          }
          last = m.index + m[0].length;
        }
        if (last < desc.length) {
          tokens.push({ type: "text", text: desc.slice(last) });
        }

        // Helper to flush buffered inline tokens into lines
        const flushInlineBuffer = (buffer) => {
          if (!buffer.length) return;
          // We will render word by word to respect max width
          pdf.setFontSize(9);
          const lineHeight = 4;
          let x = margin;
          const maxX = pageWidth - margin;
          const spaceW = pdf.getTextWidth(" ");
          const advanceY = () => {
            currentY += lineHeight;
            if (currentY > pageHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            x = margin;
          };

          for (let segIdx = 0; segIdx < buffer.length; segIdx++) {
            const seg = buffer[segIdx];
            // Ensure a space between segments (if not first on line)
            if (segIdx > 0) {
              const spaceW2 = pdf.getTextWidth(" ");
              if (x + spaceW2 > maxX) {
                advanceY();
              }
              pdf.setTextColor(0, 0, 0);
              pdf.text(" ", x, currentY);
              x += spaceW2;
            }
            const color = seg.type === "link" ? [59, 130, 246] : [0, 0, 0];
            const words = seg.text.split(/\s+/);
            words.forEach((w, idx) => {
              const word = idx < words.length - 1 ? w + " " : w; // keep spacing
              const wWidth = pdf.getTextWidth(word);
              if (x + wWidth > maxX) {
                advanceY();
              }
              pdf.setTextColor(...color);
              if (seg.type === "link" && idx === 0) {
                pdf.textWithLink(word, x, currentY, { url: seg.url });
              } else {
                pdf.text(word, x, currentY);
              }
              x += wWidth;
            });
          }
          // reset color and move to next line after finishing paragraph
          pdf.setTextColor(0, 0, 0);
          currentY += lineHeight + 1;
        };

        let inlineBuf = [];
        for (const t of tokens) {
          if (t.type === "newline") {
            flushInlineBuffer(inlineBuf);
            inlineBuf = [];
          } else if (t.type === "embed") {
            flushInlineBuffer(inlineBuf);
            inlineBuf = [];
            const embed = embeds?.[t.idx];
            if (embed) {
              const cap = sanitizeText(embed.abovePhotoCaption || "Media file");
              await addReferenceBox(embed.url || embed, cap);
              usedSet.add(t.idx);
            }
          } else if (t.type === "link") {
            inlineBuf.push({ ...t, text: sanitizeText(t.label) });
          } else {
            inlineBuf.push({ type: "text", text: sanitizeText(t.text) });
          }
        }
        flushInlineBuffer(inlineBuf);
      };
      // ---------------------------------------------------------------------------

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

      // Download date + latest version note
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(255, 255, 255);
      const downloadDate = new Date().toLocaleDateString();
      const notice1 = `Downloaded on ${downloadDate}.`;
      const notice2 = `For the latest version visit batikanor.com/projects/en`;
      pdf.text(notice1, margin, 16);
      const notice1W = pdf.getTextWidth(notice1 + " ");
      pdf.textWithLink(notice2, margin + notice1W, 16, {
        url: "https://batikanor.com/projects/en",
      });

      const headerHeight = 20;
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
      const achievementsSorted = achievements
        .filter((a) => a && a.title)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const totalAchievements = achievementsSorted.length;
      for (let achIdx = 0; achIdx < totalAchievements; achIdx++) {
        const achievement = achievementsSorted[achIdx];
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
          // Ensure "References:" heading is not placed too close to bottom
          if (currentY > pageHeight - margin - 25) {
            pdf.addPage();
            currentY = margin;
          }
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

        // Update progress bar
        setProgress((achIdx + 1) / totalAchievements);

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
            // page number right-aligned
            const pLabel = (entry.page + pagesInserted).toString();
            pdf.text(
              pLabel,
              pageWidth - margin - pdf.getTextWidth(pLabel),
              tocY
            );
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
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(107, 114, 128);
        const label = `Page ${p} / ${totalPages}`;
        pdf.text(
          label,
          pageWidth - margin - pdf.getTextWidth(label),
          pageHeight - 8
        );
      }

      pdf.setPage(totalPages);
      /* ------------------------------------------------------------------ */

      const fileName = compressPdf
        ? "batikan-achievements-summary-compressed.pdf"
        : includeImages
        ? "batikan-achievements-summary-with-images.pdf"
        : "batikan-achievements-summary.pdf";

      pdf.save(fileName);
    } catch (e) {
      console.error(e);
      alert("PDF generation failed. Check console for details.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // Auto-trigger PDF generation on mount if desired
  useEffect(() => {
    if (autoStart) {
      generatePDF();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Options under collapsible */}
      <details className="relative">
        <summary className="cursor-pointer select-none mb-2 font-medium text-sm">
          Configure PDF export
        </summary>

        {/* Preview popover */}
        {showPreview && previewSrc && (
          <div className="absolute z-50 bg-white border shadow p-2 rounded top-full left-0 mt-2 flex flex-col items-center">
            <img
              src={previewSrc}
              alt="preview"
              className="border max-w-[300px]"
              style={{
                width: `${PREVIEW_BASE * imageScale}px`,
                height: "auto",
              }}
            />
            <span className="text-[10px] text-gray-500">{previewSize} KB</span>
          </div>
        )}

        {/* Include Images Row */}
        <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            style={{ accentColor: "#f59e0b" }}
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
          />
          <span>
            Include images in PDF
            <span className="text-xs text-gray-500">
              {" "}
              (takes time, increases size)
            </span>
          </span>

          {includeImages && (
            <>
              <span className="ml-4 text-xs whitespace-nowrap">
                Image&nbsp;size&nbsp;%
              </span>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.1"
                value={imageScale}
                onChange={(e) => setImageScale(parseFloat(e.target.value))}
                className="range range-xs w-24 sm:w-32 flex-shrink-0"
                style={{ accentColor: "#f59e0b" }}
                onMouseEnter={() => setShowPreview(true)}
                onMouseLeave={() => setShowPreview(false)}
                onTouchStart={() => setShowPreview(true)}
                onTouchEnd={() => setShowPreview(false)}
              />
              <span className="text-xs w-10 text-right">
                {Math.round(imageScale * 100)}%
              </span>
            </>
          )}
        </div>

        {/* Compress Row */}
        <div className="flex flex-wrap items-center gap-3 text-sm mt-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            style={{ accentColor: "#f59e0b" }}
            checked={compressPdf}
            onChange={(e) => setCompressPdf(e.target.checked)}
          />
          <span>Compress PDF</span>

          {compressPdf && (
            <>
              <span className="ml-4 text-xs whitespace-nowrap">
                Compression&nbsp;strength&nbsp;%
              </span>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.1"
                value={compressionStrength}
                onChange={(e) =>
                  setCompressionStrength(parseFloat(e.target.value))
                }
                className="range range-xs w-24 sm:w-32 flex-shrink-0"
                style={{ accentColor: "#f59e0b" }}
                onMouseEnter={() => setShowPreview(true)}
                onMouseLeave={() => setShowPreview(false)}
                onTouchStart={() => setShowPreview(true)}
                onTouchEnd={() => setShowPreview(false)}
              />
              <span className="text-xs w-10 text-right">
                {Math.round(compressionStrength * 100)}%
              </span>
            </>
          )}
        </div>
      </details>

      {/* Download button */}
      <button
        onClick={generatePDF}
        disabled={loading}
        className={`btn flex items-center gap-3 ${
          autoStart && hideWhenAuto ? "hidden" : ""
        }`}
      >
        <FaDownload className="text-sm" />
        {loading ? "Generating PDF..." : "Download summary of achievements"}
      </button>

      {/* Progress bar */}
      {progress !== null && (
        <div className="w-full h-2 bg-gray-200 rounded">
          <div
            className="h-full bg-blue-500 rounded"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
