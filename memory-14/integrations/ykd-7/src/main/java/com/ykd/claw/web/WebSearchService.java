package com.ykd.claw.web;


import java.io.IOException;
import java.util.List;

/** Search-engine boundary used by the Agent web-search Tool. */
public interface WebSearchService {
    List<WebSearchResult> search(String keyword) throws IOException, InterruptedException;
}
