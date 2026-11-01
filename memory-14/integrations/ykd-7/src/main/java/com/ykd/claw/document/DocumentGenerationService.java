package com.ykd.claw.document;

import com.ykd.claw.document.DocumentContent.Section;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextBox;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Generates document files from structured {@link DocumentContent} data.
 * Supports: PDF, DOCX, XLSX, PPTX, Markdown, HTML.
 */
public class DocumentGenerationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentGenerationService.class.getName());
    private static final Path OUTPUT_DIR = Path.of("generated");
    private static final String TIMESTAMP_FMT = "yyyyMMdd_HHmmss";
    private volatile Path cachedCjkFont;
    private boolean cjkFontResolved;

    /**
     * Generate a document file in the specified format.
     *
     * @param content structured document content
     * @param format  target format: pdf, docx, xlsx, pptx, md, html
     * @return path to the generated file
     */
    public Path generate(DocumentContent content, String format) throws IOException {
        Files.createDirectories(OUTPUT_DIR);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern(TIMESTAMP_FMT));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String ext = resolveExtension(format);
        Path outputPath = OUTPUT_DIR.resolve("doc_" + timestamp + "_" + suffix + "." + ext);

        return switch (ext) {
            case "pdf" -> renderPdf(content, outputPath);
            case "docx" -> renderDocx(content, outputPath);
            case "xlsx" -> renderXlsx(content, outputPath);
            case "pptx" -> renderPptx(content, outputPath);
            case "md" -> renderMarkdown(content, outputPath);
            case "html" -> renderHtml(content, outputPath);
            default -> throw new IllegalArgumentException("Unsupported format: " + format);
        };
    }

    /**
     * Normalize format string to file extension.
     */
    public static String resolveExtension(String format) {
        if (format == null || format.isBlank()) return "pdf";
        String normalized = format.trim().toLowerCase().replace(".", "");
        return switch (normalized) {
            case "pdf" -> "pdf";
            case "doc", "docx", "word" -> "docx";
            case "xls", "xlsx", "excel" -> "xlsx";
            case "ppt", "pptx", "powerpoint" -> "pptx";
            case "md", "markdown" -> "md";
            case "html", "htm", "web" -> "html";
            default -> throw new IllegalArgumentException("Unsupported format: " + format);
        };
    }

    // ==================== PDF ====================

    private Path renderPdf(DocumentContent content, Path outputPath) throws IOException {
        // Use POI to create a simple PDF via HTML intermediate
        // For proper PDF with Chinese support, we'll create a temporary HTML and convert
        String html = toHtmlString(content);
        Path tempHtml = Files.createTempFile("docgen-", ".html");
        try {
            Files.writeString(tempHtml, html, StandardCharsets.UTF_8);
            // Since we don't want to add wkhtmltopdf dependency, generate a simple PDF directly
            renderPdfDirect(content, outputPath);
        } finally {
            Files.deleteIfExists(tempHtml);
        }
        return outputPath;
    }

    private void renderPdfDirect(DocumentContent content, Path outputPath) throws IOException {
        try (PDDocument doc = new PDDocument()) {

            // Load a font that supports CJK characters
            PDType0Font font = null;
            try {
                Path fontPath = findCjkFont();
                if (fontPath != null) {
                    font = PDType0Font.load(doc, fontPath.toFile());
                }
            } catch (Exception e) {
                LOGGER.warn("Failed to load CJK font: " + e.getMessage() + " (fontPath=" + findCjkFont() + ")");
            }
            boolean useCjk = font != null;
            PDFont bodyFont = useCjk
                    ? font : new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            // Pre-strip emoji from content since CJK fonts don't include emoji glyphs
            stripEmojiFromContent(content);

            float y = 720;
            float leftMargin = 50;
            float pageWidth = 550;

            // Mutable holders for lambda-safe page management
            final PDPage[] pageRef = new PDPage[]{new PDPage()};
            doc.addPage(pageRef[0]);
            final PDPageContentStream[] csRef = new PDPageContentStream[]{new PDPageContentStream(doc, pageRef[0])};

            // Helper to create new page when content overflows
            java.util.function.Supplier<PDPageContentStream> newPage = () -> {
                try {
                    csRef[0].close();
                    PDPage page = new PDPage();
                    doc.addPage(page);
                    pageRef[0] = page;
                    PDPageContentStream stream = new PDPageContentStream(doc, page);
                    csRef[0] = stream;
                    return stream;
                } catch (IOException e) {
                    throw new RuntimeException("Failed to create new PDF page", e);
                }
            };

            // Title
            if (content.getTitle() != null && !content.getTitle().isBlank()) {
                csRef[0].beginText();
                csRef[0].setFont(useCjk ? font : new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), useCjk ? 20 : 18);
                csRef[0].newLineAtOffset(leftMargin, y);
                csRef[0].showText(content.getTitle());
                csRef[0].endText();
                y -= 30;
            }

            // Subtitle
            if (content.getSubtitle() != null && !content.getSubtitle().isBlank()) {
                csRef[0].beginText();
                csRef[0].setFont(useCjk ? font : new PDType1Font(Standard14Fonts.FontName.HELVETICA), 14);
                csRef[0].newLineAtOffset(leftMargin, y);
                csRef[0].showText(content.getSubtitle());
                csRef[0].endText();
                y -= 25;
            }

            // Author + date
            if ((content.getAuthor() != null && !content.getAuthor().isBlank())
                    || (content.getDate() != null && !content.getDate().isBlank())) {
                String meta = (content.getAuthor() != null ? content.getAuthor() : "")
                        + (content.getDate() != null ? "  " + content.getDate() : "");
                csRef[0].beginText();
                csRef[0].setFont(useCjk ? font : new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                csRef[0].newLineAtOffset(leftMargin, y);
                csRef[0].showText(meta.trim());
                csRef[0].endText();
                y -= 25;
            }

            // Divider line
            if (content.getTitle() != null) {
                csRef[0].setLineWidth(0.5f);
                csRef[0].moveTo(leftMargin, y + 5);
                csRef[0].lineTo(leftMargin + pageWidth, y + 5);
                csRef[0].stroke();
                y -= 15;
            }

            // Sections
            if (content.getSections() != null) {
                for (Section section : content.getSections()) {
                    if (y < 80) {
                        newPage.get();
                        y = 720;
                    }

                    // Section heading
                    if (section.getHeading() != null && !section.getHeading().isBlank()) {
                        csRef[0].beginText();
                        csRef[0].setFont(useCjk ? font : new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 14);
                        csRef[0].newLineAtOffset(leftMargin, y);
                        csRef[0].showText(section.getHeading());
                        csRef[0].endText();
                        y -= 22;
                    }

                    // Paragraphs
                    if (section.getParagraphs() != null) {
                        for (String para : section.getParagraphs()) {
                            if (para == null || para.isBlank()) continue;
                            y = drawWrappedText(doc, csRef, bodyFont, para,
                                    leftMargin, y, pageWidth);
                            y -= 8;
                        }
                    }

                    // Bullets
                    if (section.getBullets() != null) {
                        for (String bullet : section.getBullets()) {
                            if (bullet == null || bullet.isBlank()) continue;
                            y = drawWrappedText(doc, csRef, bodyFont, "  -  " + bullet,
                                    leftMargin, y, pageWidth);
                            y -= 4;
                        }
                    }

                    // Tables
                    if (section.getTables() != null && !section.getTables().isEmpty()) {
                        y -= 5;
                        for (List<String> row : section.getTables()) {
                            if (y < 80) {
                                newPage.get();
                                y = 720;
                            }
                            StringBuilder sb = new StringBuilder();
                            for (int i = 0; i < row.size(); i++) {
                                if (i > 0) sb.append("  |  ");
                                sb.append(row.get(i));
                            }
                            y = drawWrappedText(doc, csRef, bodyFont, sb.toString(),
                                    leftMargin, y, pageWidth);
                            y -= 4;
                        }
                        y -= 8;
                    }

                    y -= 10;
                }
            }

            csRef[0].close();
            doc.save(outputPath.toFile());
        }
    }

    private float drawWrappedText(PDDocument doc, PDPageContentStream[] csRef, PDFont font,
                                  String text, float x, float y, float maxWidth) throws IOException {
        float fontSize = 11;
        float leading = 15;
        String printable = printableText(font, text);
        StringBuilder line = new StringBuilder();

        for (int offset = 0; offset < printable.length();) {
            int codePoint = printable.codePointAt(offset);
            String character = new String(Character.toChars(codePoint));
            offset += Character.charCount(codePoint);
            if ("\n".equals(character)) {
                y = writePdfLine(doc, csRef, font, line.toString(), x, y, fontSize, leading);
                line.setLength(0);
                continue;
            }
            String candidate = line + character;
            if (!line.isEmpty() && textWidth(font, candidate, fontSize) > maxWidth) {
                y = writePdfLine(doc, csRef, font, line.toString(), x, y, fontSize, leading);
                line.setLength(0);
            }
            line.append(character);
        }
        if (!line.isEmpty()) y = writePdfLine(doc, csRef, font, line.toString(), x, y, fontSize, leading);
        return y;
    }

    private static float writePdfLine(PDDocument doc, PDPageContentStream[] csRef, PDFont font,
                                      String line, float x, float y, float fontSize,
                                      float leading) throws IOException {
        if (y < 55) {
            csRef[0].close();
            PDPage page = new PDPage();
            doc.addPage(page);
            csRef[0] = new PDPageContentStream(doc, page);
            y = 720;
        }
        csRef[0].beginText();
        csRef[0].setFont(font, fontSize);
        csRef[0].newLineAtOffset(x, y);
        csRef[0].showText(line.stripTrailing());
        csRef[0].endText();
        return y - leading;
    }

    private static float textWidth(PDFont font, String text, float fontSize) throws IOException {
        return font.getStringWidth(text) / 1000 * fontSize;
    }

    private static String printableText(PDFont font, String text) {
        StringBuilder result = new StringBuilder();
        text.codePoints().forEach(codePoint -> {
            String character = new String(Character.toChars(codePoint));
            if ("\n".equals(character)) {
                result.append(character);
                return;
            }
            try {
                font.getStringWidth(character);
                result.append(character);
            } catch (Exception ignored) {
                result.append('?');
            }
        });
        return result.toString();
    }

    private Path findCjkFont() {
        if (cjkFontResolved) return cachedCjkFont;
        synchronized (this) {
            if (cjkFontResolved) return cachedCjkFont;
            // Prefer standalone TTF files over TTC (TrueType Collection) since PDFBox 3.x
            // has issues loading TTC files directly.
            String[] candidates = {
                    // Windows - standalone TTF preferred
                    "C:/Windows/Fonts/simhei.ttf",    // 黑体 (standalone TTF)
                    "C:/Windows/Fonts/simsunb.ttf",   // 宋体粗 (standalone TTF)
                    "C:/Windows/Fonts/simkai.ttf",    // 楷体 (standalone TTF)
                    // Windows - TTC (may fail in PDFBox 3.x)
                    "C:/Windows/Fonts/msyh.ttc",      // 微软雅黑
                    "C:/Windows/Fonts/simsun.ttc",    // 宋体
                    // Linux
                    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
                    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
                    // macOS
                    "/System/Library/Fonts/PingFang.ttc",
                    "/System/Library/Fonts/STHeiti Light.ttc"
            };
            for (String path : candidates) {
                Path p = Path.of(path);
                if (Files.exists(p)) {
                    cachedCjkFont = p;
                    cjkFontResolved = true;
                    return p;
                }
            }
            cjkFontResolved = true;
            return null;
        }
    }

    // ==================== Word (DOCX) ====================

    private Path renderDocx(DocumentContent content, Path outputPath) throws IOException {
        try (XWPFDocument doc = new XWPFDocument()) {
            // Title
            if (content.getTitle() != null && !content.getTitle().isBlank()) {
                XWPFParagraph titlePara = doc.createParagraph();
                XWPFRun titleRun = titlePara.createRun();
                titleRun.setBold(true);
                titleRun.setFontSize(22);
                titleRun.setText(content.getTitle());
            }

            // Subtitle
            if (content.getSubtitle() != null && !content.getSubtitle().isBlank()) {
                XWPFParagraph subPara = doc.createParagraph();
                XWPFRun subRun = subPara.createRun();
                subRun.setFontSize(14);
                subRun.setColor("666666");
                subRun.setText(content.getSubtitle());
            }

            // Author + date
            if (content.getAuthor() != null || content.getDate() != null) {
                XWPFParagraph metaPara = doc.createParagraph();
                XWPFRun metaRun = metaPara.createRun();
                metaRun.setFontSize(10);
                metaRun.setColor("999999");
                String meta = (content.getAuthor() != null ? content.getAuthor() : "")
                        + (content.getDate() != null ? "  " + content.getDate() : "");
                metaRun.setText(meta.trim());
            }

            // Sections
            if (content.getSections() != null) {
                for (Section section : content.getSections()) {
                    if (section.getHeading() != null && !section.getHeading().isBlank()) {
                        XWPFParagraph hPara = doc.createParagraph();
                        XWPFRun hRun = hPara.createRun();
                        hRun.setBold(true);
                        hRun.setFontSize(16);
                        hRun.setText(section.getHeading());
                    }

                    if (section.getParagraphs() != null) {
                        for (String para : section.getParagraphs()) {
                            if (para == null || para.isBlank()) continue;
                            XWPFParagraph pPara = doc.createParagraph();
                            XWPFRun pRun = pPara.createRun();
                            pRun.setFontSize(11);
                            pRun.setText(para);
                        }
                    }

                    if (section.getBullets() != null) {
                        for (String bullet : section.getBullets()) {
                            if (bullet == null || bullet.isBlank()) continue;
                            XWPFParagraph bPara = doc.createParagraph();
                            bPara.setIndentationLeft(720); // 0.5 inch indent
                            XWPFRun bRun = bPara.createRun();
                            bRun.setFontSize(11);
                            bRun.setText("•  " + bullet);
                        }
                    }

                    if (section.getTables() != null && !section.getTables().isEmpty()) {
                        XWPFTable table = doc.createTable();
                        for (List<String> row : section.getTables()) {
                            XWPFTableRow tRow = table.createRow();
                            for (int i = 0; i < row.size(); i++) {
                                XWPFTableCell cell = tRow.getCell(i);
                                if (cell == null) cell = tRow.createCell();
                                cell.setText(row.get(i));
                            }
                        }
                    }
                }
            }

            try (OutputStream os = Files.newOutputStream(outputPath)) {
                doc.write(os);
            }
        }
        return outputPath;
    }

    // ==================== Excel (XLSX) ====================

    private Path renderXlsx(DocumentContent content, Path outputPath) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            XSSFSheet sheet = workbook.createSheet(content.getTitle() != null ? content.getTitle() : "Sheet1");

            int rowIdx = 0;

            // Title row
            if (content.getTitle() != null && !content.getTitle().isBlank()) {
                XSSFRow titleRow = sheet.createRow(rowIdx++);
                XSSFCell titleCell = titleRow.createCell(0);
                titleCell.setCellValue(content.getTitle());
            }

            // Sections
            if (content.getSections() != null) {
                for (Section section : content.getSections()) {
                    // Section heading
                    if (section.getHeading() != null && !section.getHeading().isBlank()) {
                        XSSFRow hRow = sheet.createRow(rowIdx++);
                        XSSFCell hCell = hRow.createCell(0);
                        hCell.setCellValue(section.getHeading());
                    }

                    // Tables → spreadsheet rows
                    if (section.getTables() != null) {
                        for (List<String> row : section.getTables()) {
                            XSSFRow dataRow = sheet.createRow(rowIdx++);
                            for (int i = 0; i < row.size(); i++) {
                                XSSFCell cell = dataRow.createCell(i);
                                cell.setCellValue(row.get(i));
                            }
                        }
                    }

                    // Paragraphs as rows
                    if (section.getParagraphs() != null) {
                        for (String para : section.getParagraphs()) {
                            if (para == null || para.isBlank()) continue;
                            XSSFRow pRow = sheet.createRow(rowIdx++);
                            pRow.createCell(0).setCellValue(para);
                        }
                    }

                    // Bullets
                    if (section.getBullets() != null) {
                        for (String bullet : section.getBullets()) {
                            if (bullet == null || bullet.isBlank()) continue;
                            XSSFRow bRow = sheet.createRow(rowIdx++);
                            bRow.createCell(0).setCellValue("•  " + bullet);
                        }
                    }
                }
            }

            // Auto-size columns
            if (rowIdx > 0) {
                sheet.autoSizeColumn(0);
            }

            try (OutputStream os = Files.newOutputStream(outputPath)) {
                workbook.write(os);
            }
        }
        return outputPath;
    }

    // ==================== PowerPoint (PPTX) ====================

    private Path renderPptx(DocumentContent content, Path outputPath) throws IOException {
        try (XMLSlideShow show = new XMLSlideShow()) {
            show.setPageSize(new java.awt.Dimension(1280, 720));

            // Title slide
            XSLFSlide titleSlide = show.createSlide();
            if (content.getTitle() != null && !content.getTitle().isBlank()) {
                XSLFTextBox titleBox = titleSlide.createTextBox();
                titleBox.setText(content.getTitle());
                titleBox.setAnchor(new java.awt.geom.Rectangle2D.Double(100, 180, 1080, 120));
            }
            if (content.getSubtitle() != null && !content.getSubtitle().isBlank()) {
                XSLFTextBox subBox = titleSlide.createTextBox();
                subBox.setText(content.getSubtitle());
                subBox.setAnchor(new java.awt.geom.Rectangle2D.Double(100, 320, 1080, 80));
            }

            // One slide per section
            if (content.getSections() != null) {
                for (Section section : content.getSections()) {
                    XSLFSlide slide = show.createSlide();

                    // Section heading
                    if (section.getHeading() != null && !section.getHeading().isBlank()) {
                        XSLFTextBox headingBox = slide.createTextBox();
                        headingBox.setText(section.getHeading());
                        headingBox.setAnchor(new java.awt.geom.Rectangle2D.Double(80, 40, 1120, 80));
                    }

                    // Build body text
                    StringBuilder body = new StringBuilder();
                    if (section.getParagraphs() != null) {
                        for (String para : section.getParagraphs()) {
                            if (para != null && !para.isBlank()) {
                                body.append(para).append("\n\n");
                            }
                        }
                    }
                    if (section.getBullets() != null) {
                        for (String bullet : section.getBullets()) {
                            if (bullet != null && !bullet.isBlank()) {
                                body.append("•  ").append(bullet).append("\n");
                            }
                        }
                    }
                    if (section.getTables() != null) {
                        for (List<String> row : section.getTables()) {
                            body.append(String.join("  |  ", row)).append("\n");
                        }
                    }

                    if (body.length() > 0) {
                        XSLFTextBox contentBox = slide.createTextBox();
                        contentBox.setText(body.toString().trim());
                        contentBox.setAnchor(new java.awt.geom.Rectangle2D.Double(80, 140, 1120, 520));
                    }
                }
            }

            try (java.io.OutputStream os = Files.newOutputStream(outputPath)) {
                show.write(os);
            }
        }
        return outputPath;
    }

    // ==================== Markdown ====================

    private Path renderMarkdown(DocumentContent content, Path outputPath) throws IOException {
        StringBuilder sb = new StringBuilder();

        if (content.getTitle() != null && !content.getTitle().isBlank()) {
            sb.append("# ").append(content.getTitle()).append("\n\n");
        }
        if (content.getSubtitle() != null && !content.getSubtitle().isBlank()) {
            sb.append("*").append(content.getSubtitle()).append("*\n\n");
        }
        if (content.getAuthor() != null || content.getDate() != null) {
            String meta = (content.getAuthor() != null ? "作者: " + content.getAuthor() : "")
                    + (content.getDate() != null ? "  |  日期: " + content.getDate() : "");
            sb.append(meta.trim()).append("\n\n---\n\n");
        }

        if (content.getSections() != null) {
            for (Section section : content.getSections()) {
                if (section.getHeading() != null && !section.getHeading().isBlank()) {
                    sb.append("## ").append(section.getHeading()).append("\n\n");
                }
                if (section.getParagraphs() != null) {
                    for (String para : section.getParagraphs()) {
                        if (para != null && !para.isBlank()) {
                            sb.append(para).append("\n\n");
                        }
                    }
                }
                if (section.getBullets() != null) {
                    for (String bullet : section.getBullets()) {
                        if (bullet != null && !bullet.isBlank()) {
                            sb.append("- ").append(bullet).append("\n");
                        }
                    }
                    sb.append("\n");
                }
                if (section.getTables() != null && !section.getTables().isEmpty()) {
                    for (int i = 0; i < section.getTables().size(); i++) {
                        List<String> row = section.getTables().get(i);
                        sb.append("| ").append(String.join(" | ", row)).append(" |\n");
                        if (i == 0) {
                            sb.append("|");
                            for (int j = 0; j < row.size(); j++) sb.append(" --- |");
                            sb.append("\n");
                        }
                    }
                    sb.append("\n");
                }
            }
        }

        Files.writeString(outputPath, sb.toString(), StandardCharsets.UTF_8);
        return outputPath;
    }

    // ==================== HTML ====================

    private Path renderHtml(DocumentContent content, Path outputPath) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        if (content.getTitle() != null) {
            sb.append("<title>").append(escHtml(content.getTitle())).append("</title>\n");
        }
        sb.append("<style>\n");
        sb.append("body{font-family:'Microsoft YaHei',sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.6}\n");
        sb.append("h1{color:#333;border-bottom:2px solid #007bff;padding-bottom:10px}\n");
        sb.append("h2{color:#555;margin-top:2em}\n");
        sb.append("table{border-collapse:collapse;width:100%;margin:1em 0}\n");
        sb.append("th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}\n");
        sb.append("th{background:#f5f5f5}\n");
        sb.append("ul{padding-left:2em}\n");
        sb.append("li{margin:4px 0}\n");
        sb.append(".meta{color:#888;font-size:0.9em}\n");
        sb.append("</style>\n</head>\n<body>\n");

        if (content.getTitle() != null && !content.getTitle().isBlank()) {
            sb.append("<h1>").append(escHtml(content.getTitle())).append("</h1>\n");
        }
        if (content.getSubtitle() != null && !content.getSubtitle().isBlank()) {
            sb.append("<p class=\"meta\">").append(escHtml(content.getSubtitle())).append("</p>\n");
        }
        if (content.getAuthor() != null || content.getDate() != null) {
            sb.append("<p class=\"meta\">");
            if (content.getAuthor() != null) sb.append("作者: ").append(escHtml(content.getAuthor()));
            if (content.getDate() != null) sb.append("  |  日期: ").append(escHtml(content.getDate()));
            sb.append("</p>\n");
        }

        if (content.getSections() != null) {
            for (Section section : content.getSections()) {
                if (section.getHeading() != null && !section.getHeading().isBlank()) {
                    sb.append("<h2>").append(escHtml(section.getHeading())).append("</h2>\n");
                }
                if (section.getParagraphs() != null) {
                    for (String para : section.getParagraphs()) {
                        if (para != null && !para.isBlank()) {
                            sb.append("<p>").append(escHtml(para)).append("</p>\n");
                        }
                    }
                }
                if (section.getBullets() != null) {
                    sb.append("<ul>\n");
                    for (String bullet : section.getBullets()) {
                        if (bullet != null && !bullet.isBlank()) {
                            sb.append("<li>").append(escHtml(bullet)).append("</li>\n");
                        }
                    }
                    sb.append("</ul>\n");
                }
                if (section.getTables() != null && !section.getTables().isEmpty()) {
                    sb.append("<table>\n");
                    boolean isHeader = true;
                    for (List<String> row : section.getTables()) {
                        sb.append("<tr>");
                        String tag = isHeader ? "th" : "td";
                        for (String cell : row) {
                            sb.append("<").append(tag).append(">").append(escHtml(cell)).append("</").append(tag).append(">");
                        }
                        sb.append("</tr>\n");
                        isHeader = false;
                    }
                    sb.append("</table>\n");
                }
            }
        }

        sb.append("</body>\n</html>");

        Files.writeString(outputPath, sb.toString(), StandardCharsets.UTF_8);
        return outputPath;
    }

    private String toHtmlString(DocumentContent content) {
        // Reuse the HTML renderer output
        try {
            Path tempHtml = OUTPUT_DIR.resolve("_temp_render.html");
            renderHtml(content, tempHtml);
            String html = Files.readString(tempHtml, StandardCharsets.UTF_8);
            Files.deleteIfExists(tempHtml);
            return html;
        } catch (IOException e) {
            return "<p>Error generating HTML</p>";
        }
    }

    // ==================== Emoji stripping for PDF ====================

    /**
     * Strip emoji characters from DocumentContent in-place, since CJK fonts
     * used in PDF rendering don't include emoji glyphs.
     */
    private static void stripEmojiFromContent(DocumentContent content) {
        if (content.getTitle() != null) content.setTitle(stripEmoji(content.getTitle()));
        if (content.getSubtitle() != null) content.setSubtitle(stripEmoji(content.getSubtitle()));
        if (content.getAuthor() != null) content.setAuthor(stripEmoji(content.getAuthor()));
        if (content.getSections() == null) return;
        for (DocumentContent.Section section : content.getSections()) {
            if (section.getHeading() != null) section.setHeading(stripEmoji(section.getHeading()));
            if (section.getParagraphs() != null) {
                section.setParagraphs(section.getParagraphs().stream()
                        .map(DocumentGenerationService::stripEmoji).toList());
            }
            if (section.getBullets() != null) {
                section.setBullets(section.getBullets().stream()
                        .map(DocumentGenerationService::stripEmoji).toList());
            }
            if (section.getTables() != null) {
                section.setTables(section.getTables().stream()
                        .map(row -> row.stream()
                                .map(DocumentGenerationService::stripEmoji).toList())
                        .toList());
            }
        }
    }

    /**
     * Remove emoji and other non-BMP characters that CJK fonts can't render.
     */
    private static String stripEmoji(String text) {
        if (text == null) return null;
        // Remove characters outside Basic Multilingual Plane (U+0000 to U+FFFF)
        // This covers all emoji (U+1F000–U+1FFFF) while keeping CJK (U+4E00–U+9FFF)
        return text.replaceAll("[\\x{10000}-\\x{10FFFF}]", "")
                .replaceAll("[\\x{200D}\\x{FE0F}\\x{20E3}]", ""); // zero-width joiner, variation selector
    }

    private static String escHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;");
    }
}
