package com.sekai.memory.offline;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + HOST + "/index.html";
    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingExport;
    private static final int OPEN_BACKUP = 101;
    private static final int SAVE_BACKUP = 102;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(255, 247, 252));
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(255, 247, 252));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUserAgentString("SekaiMemoryAndroidOffline/1.0.0");

        webView.addJavascriptInterface(new BackupBridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] acceptedTypes = params.getAcceptTypes();
                String accept = acceptedTypes != null && acceptedTypes.length > 0
                        ? acceptedTypes[0] : "*/*";
                intent.setType(accept == null || accept.isBlank() ? "*/*" : accept);
                startActivityForResult(intent, OPEN_BACKUP);
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!HOST.equals(request.getUrl().getHost())) return blocked();
                String path = request.getUrl().getPath();
                if (path == null || "/".equals(path)) path = "/index.html";
                if (path.contains("..")) return blocked();
                try {
                    InputStream stream = getAssets().open("www" + path);
                    return new WebResourceResponse(mimeType(path), "UTF-8", stream);
                } catch (IOException ignored) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
                            new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
        });

        if (savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
    }

    private final class BackupBridge {
        @JavascriptInterface
        public void exportJson(String json, String fileName) {
            pendingExport = json;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);
            runOnUiThread(() -> startActivityForResult(intent, SAVE_BACKUP));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode == OPEN_BACKUP) {
            Uri[] uris = resultCode == RESULT_OK && result != null && result.getData() != null
                    ? new Uri[]{result.getData()} : null;
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(uris);
            fileChooserCallback = null;
        } else if (requestCode == SAVE_BACKUP) {
            boolean success = false;
            if (resultCode == RESULT_OK && result != null && result.getData() != null && pendingExport != null) {
                try (OutputStream output = getContentResolver().openOutputStream(result.getData())) {
                    if (output != null) {
                        output.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                        success = true;
                    }
                } catch (IOException ignored) { }
            }
            pendingExport = null;
            webView.evaluateJavascript("window.onBackupSaved(" + success + ")", null);
        }
    }

    private static WebResourceResponse blocked() {
        byte[] body = "Offline".getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline", null,
                new ByteArrayInputStream(body));
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".js")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".png")) return "image/png";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed == null ? "application/octet-stream" : guessed;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
