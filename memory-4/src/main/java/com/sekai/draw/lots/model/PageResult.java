package com.sekai.draw.lots.model;

import java.util.List;

public class PageResult<T> {
    private final List<T> items;
    private final int total;
    private final int page;
    private final int size;
    public PageResult(List<T> items, int total, int page, int size) { this.items = items; this.total = total; this.page = page; this.size = size; }
    public List<T> getItems() { return items; }
    public int getTotal() { return total; }
    public int getPage() { return page; }
    public int getPages() { return Math.max(1, (total + size - 1) / size); }
    public boolean isPrevious() { return page > 1; }
    public boolean isNext() { return page < getPages(); }
}
