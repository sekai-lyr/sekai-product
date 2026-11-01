package com.ykd.claw.document;

import org.apache.tika.exception.TikaException;
import org.apache.tika.exception.WriteLimitReachedException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.xml.sax.SAXException;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Extracts text and metadata from common documents through Apache Tika. */
@Service
public class DocumentReaderService {

    public static final int DEFAULT_MAX_CHARACTERS = 30_000;
    public static final int MAX_CHARACTERS = 100_000;
    public static final long MAX_FILE_SIZE = 50L * 1024 * 1024;

    private final AutoDetectParser parser;

    public DocumentReaderService() {
        this.parser = new AutoDetectParser();
    }

    public DocumentContent read(Path file) throws IOException {
        return read(file, DEFAULT_MAX_CHARACTERS);
    }

    public DocumentContent read(Path file, int maxCharacters) throws IOException {
        Path normalized = file == null ? null : file.toAbsolutePath().normalize();
        if (normalized == null || !Files.isRegularFile(normalized)) {
            throw new IOException("Document does not exist or is not a regular file: " + file);
        }
        long size = Files.size(normalized);
        if (size == 0) throw new IOException("Document is empty: " + normalized.getFileName());
        if (size > MAX_FILE_SIZE) {
            throw new IOException("Document exceeds the 50 MB extraction limit");
        }
        if (maxCharacters < 1 || maxCharacters > MAX_CHARACTERS) {
            throw new IllegalArgumentException("maxCharacters must be between 1 and " + MAX_CHARACTERS);
        }

        Metadata metadata = new Metadata();
        metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, normalized.getFileName().toString());
        BodyContentHandler handler = new BodyContentHandler(maxCharacters);
        boolean truncated = false;
        try (InputStream input = Files.newInputStream(normalized)) {
            try {
                parser.parse(input, handler, metadata, new ParseContext());
            } catch (SAXException e) {
                if (WriteLimitReachedException.isWriteLimitReached(e)) {
                    truncated = true;
                } else {
                    throw new IOException("Unable to extract document text", e);
                }
            } catch (TikaException e) {
                throw new IOException("Unable to parse document: " + e.getMessage(), e);
            }
        }

        String text = normalizeText(handler.toString());
        String contentType = metadata.get(Metadata.CONTENT_TYPE);
        Map<String, String> selectedMetadata = new LinkedHashMap<>();
        addMetadata(selectedMetadata, "title", metadata.get(TikaCoreProperties.TITLE));
        addMetadata(selectedMetadata, "author", metadata.get(TikaCoreProperties.CREATOR));
        addMetadata(selectedMetadata, "created", metadata.get(TikaCoreProperties.CREATED));
        addMetadata(selectedMetadata, "modified", metadata.get(TikaCoreProperties.MODIFIED));

        return new DocumentContent(normalized, contentType, text, truncated, size,
                Map.copyOf(selectedMetadata));
    }

    public String formatForAi(DocumentContent content) {
        StringBuilder result = new StringBuilder();
        result.append("Document: ").append(content.path().getFileName()).append('\n');
        result.append("Content-Type: ").append(content.contentType() == null
                ? "unknown" : content.contentType()).append('\n');
        if (!content.metadata().isEmpty()) {
            result.append("Metadata: ").append(content.metadata()).append('\n');
        }
        result.append("Truncated: ").append(content.truncated()).append("\n\n");
        result.append(content.text().isBlank() ? "(no extractable text)" : content.text());
        return result.toString();
    }

    private static String normalizeText(String text) {
        if (text == null) return "";
        return text.replace("\r\n", "\n")
                .replace('\r', '\n')
                .replaceAll("[\\t\\x0B\\f ]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private static void addMetadata(Map<String, String> target, String name, String value) {
        if (value != null && !value.isBlank()) target.put(name, value);
    }

    public record DocumentContent(Path path, String contentType, String text, boolean truncated,
                                  long fileSize, Map<String, String> metadata) {}
}
