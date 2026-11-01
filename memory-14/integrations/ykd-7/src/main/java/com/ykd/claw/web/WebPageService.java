package com.ykd.claw.web;


import java.io.IOException;

/** Boundary for fetching and extracting content from a public web page. */
public interface WebPageService {
    WebPageContent fetch(String url) throws IOException, InterruptedException;
}
