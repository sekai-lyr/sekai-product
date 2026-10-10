package com.sekai.dataobject.model;

public class DashboardStats {

    private long seriesCount;

    private long characterCount;

    private long quoteCount;

    private long audioCount;

    public long getSeriesCount() {
        return seriesCount;
    }

    public void setSeriesCount(long seriesCount) {
        this.seriesCount = seriesCount;
    }

    public long getCharacterCount() {
        return characterCount;
    }

    public void setCharacterCount(long characterCount) {
        this.characterCount = characterCount;
    }

    public long getQuoteCount() {
        return quoteCount;
    }

    public void setQuoteCount(long quoteCount) {
        this.quoteCount = quoteCount;
    }

    public long getAudioCount() {
        return audioCount;
    }

    public void setAudioCount(long audioCount) {
        this.audioCount = audioCount;
    }
}
