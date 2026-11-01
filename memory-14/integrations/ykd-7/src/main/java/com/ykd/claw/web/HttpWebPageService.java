package com.ykd.claw.web;

import com.ykd.claw.infrastructure.http.WebHttpClientFactory;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

@Service
public class HttpWebPageService implements WebPageService {
    private static final Set<Integer> REDIRECT_STATUSES = Set.of(301, 302, 303, 307, 308);
    private static final String USER_AGENT = "Mozilla/5.0 (compatible; OpenClaw/1.0; web-page-tool)";

    private final HttpClient client;
    private final int maxBytes;
    private final int maxChars;
    private final int maxRedirects;
    private final Duration timeout;
    private final boolean allowPrivateAddresses;

    @Autowired
    public HttpWebPageService(
            @Value("${webpage.max-bytes:1000000}") int maxBytes,
            @Value("${webpage.max-chars:20000}") int maxChars,
            @Value("${webpage.max-redirects:5}") int maxRedirects,
            @Value("${webpage.timeout:20}") long timeoutSeconds,
            @Value("${web.proxy-url:}") String proxyUrl) {
        this(maxBytes, maxChars, maxRedirects, Duration.ofSeconds(Math.max(1, timeoutSeconds)),
                WebHttpClientFactory.create(proxyUrl, HttpClient.Redirect.NEVER), false);
    }

    HttpWebPageService(int maxBytes, int maxChars, int maxRedirects, Duration timeout,
                       HttpClient client, boolean allowPrivateAddresses) {
        this.maxBytes = Math.max(1_024, maxBytes);
        this.maxChars = Math.max(1_000, maxChars);
        this.maxRedirects = Math.max(0, Math.min(10, maxRedirects));
        this.timeout = timeout;
        this.client = client;
        this.allowPrivateAddresses = allowPrivateAddresses;
    }

    @Override
    public WebPageContent fetch(String url) throws IOException, InterruptedException {
        URI current = parseUrl(url);
        for (int redirect = 0; redirect <= maxRedirects; redirect++) {
            validatePublicUri(current);
            HttpRequest request = HttpRequest.newBuilder(current).timeout(timeout)
                    .header("Accept", "text/html, application/xhtml+xml, text/plain;q=0.9")
                    .header("User-Agent", USER_AGENT).GET().build();
            HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (REDIRECT_STATUSES.contains(response.statusCode())) {
                    String location = response.headers().firstValue("Location")
                            .orElseThrow(() -> new IOException("Web page redirect did not include Location"));
                    if (redirect == maxRedirects) throw new IOException("Web page exceeded redirect limit");
                    current = current.resolve(location);
                    continue;
                }
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IOException("Web page fetch failed: HTTP " + response.statusCode());
                }
                String contentType = response.headers().firstValue("Content-Type").orElse("text/html")
                        .toLowerCase(Locale.ROOT);
                if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml+xml")
                        && !contentType.startsWith("text/plain")) {
                    throw new IOException("Unsupported web page content type: " + contentType);
                }
                long declaredLength = response.headers().firstValueAsLong("Content-Length").orElse(-1);
                if (declaredLength > maxBytes) throw new IOException("Web page exceeds size limit");
                byte[] bytes = body.readNBytes(maxBytes + 1);
                if (bytes.length > maxBytes) throw new IOException("Web page exceeds size limit");
                return contentType.startsWith("text/plain")
                        ? plainText(current, bytes) : html(current, bytes);
            }
        }
        throw new IOException("Web page exceeded redirect limit");
    }

    private WebPageContent html(URI uri, byte[] bytes) throws IOException {
        try {
            Metadata metadata = new Metadata();
            metadata.set(Metadata.CONTENT_TYPE, "text/html");
            BodyContentHandler handler = new BodyContentHandler(-1);
            new AutoDetectParser().parse(new ByteArrayInputStream(bytes), handler, metadata, new ParseContext());
            String title = metadata.get(TikaCoreProperties.TITLE);
            String content = handler.toString();
            if (content.length() > maxChars) content = content.substring(0, maxChars);
            return new WebPageContent(title == null ? "" : title.trim(), uri.toString(),
                    normalize(content));
        } catch (Exception e) {
            throw new IOException("Failed to extract web page content", e);
        }
    }

    private WebPageContent plainText(URI uri, byte[] bytes) {
        String content = new String(bytes, StandardCharsets.UTF_8);
        if (content.length() > maxChars) content = content.substring(0, maxChars);
        return new WebPageContent("", uri.toString(), normalize(content));
    }

    private void validatePublicUri(URI uri) throws IOException {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new IOException("Only public http and https URLs are allowed");
        }
        if (uri.getUserInfo() != null) throw new IOException("URLs containing credentials are not allowed");
        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443 && !allowPrivateAddresses) {
            throw new IOException("Only standard web ports 80 and 443 are allowed");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) throw new IOException("URL must include a valid host");
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if (normalizedHost.equals("localhost") || normalizedHost.endsWith(".localhost")
                || normalizedHost.endsWith(".local") || normalizedHost.endsWith(".internal")) {
            throw new IOException("Local and private network URLs are not allowed");
        }
        if (allowPrivateAddresses) return;
        for (InetAddress address : InetAddress.getAllByName(host)) {
            if (isPrivate(address)) throw new IOException("Local and private network URLs are not allowed");
        }
    }

    private static boolean isPrivate(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) return true;
        byte[] bytes = address.getAddress();
        if (address instanceof Inet4Address) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            return first == 0 || first == 127 || (first == 100 && second >= 64 && second <= 127)
                    || (first == 169 && second == 254) || (first == 198 && (second == 18 || second == 19));
        }
        return address instanceof Inet6Address && (Byte.toUnsignedInt(bytes[0]) & 0xfe) == 0xfc;
    }

    private static URI parseUrl(String value) throws IOException {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("url is required");
        try {
            return new URI(value.trim());
        } catch (URISyntaxException e) {
            throw new IOException("Invalid web page URL", e);
        }
    }

    private static String normalize(String value) {
        return value.replace('\u0000', ' ').replaceAll("[\\t\\x0B\\f\\r ]+", " ")
                .replaceAll("\\n{3,}", "\n\n").trim();
    }
}
