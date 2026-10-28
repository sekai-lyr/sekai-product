package com.sekai.picture.model;

public class ArchiveHealth {
    private int uncategorized;
    private int untagged;
    private int trashCount;
    private long storedBytes;
    private long downloads;
    public int getUncategorized() { return uncategorized; }
    public void setUncategorized(int value) { uncategorized = value; }
    public int getUntagged() { return untagged; }
    public void setUntagged(int value) { untagged = value; }
    public int getTrashCount() { return trashCount; }
    public void setTrashCount(int value) { trashCount = value; }
    public long getStoredBytes() { return storedBytes; }
    public void setStoredBytes(long value) { storedBytes = value; }
    public long getDownloads() { return downloads; }
    public void setDownloads(long value) { downloads = value; }
    public String getStorageLabel() { return String.format(java.util.Locale.ROOT, "%.1f MB", storedBytes / 1048576.0); }
}
