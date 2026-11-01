package com.ykd.claw.infrastructure.http;

import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;

public final class WebHttpClientFactory {
    private WebHttpClientFactory() { }

    public static HttpClient create(String proxyUrl, HttpClient.Redirect redirects) {
        HttpClient.Builder builder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
                .followRedirects(redirects);
        if (proxyUrl != null && !proxyUrl.isBlank()) {
            URI proxy = URI.create(proxyUrl.trim());
            if (proxy.getHost() == null) throw new IllegalArgumentException("web.proxy-url must include a host");
            int port = proxy.getPort() > 0 ? proxy.getPort() : 80;
            builder.proxy(ProxySelector.of(new InetSocketAddress(proxy.getHost(), port)));
        }
        return builder.build();
    }
}
