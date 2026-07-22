package com.sekai.draw.lots.model;

public class TaskBoardStats {
    private int total;
    private int open;
    private int done;
    private int overdue;
    private int highPriority;

    public int getCompletionPercent() {
        int visible = open + done;
        if (visible <= 0) {
            return 0;
        }
        return Math.round((float) done * 100 / visible);
    }

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public int getOpen() { return open; }
    public void setOpen(int open) { this.open = open; }
    public int getDone() { return done; }
    public void setDone(int done) { this.done = done; }
    public int getOverdue() { return overdue; }
    public void setOverdue(int overdue) { this.overdue = overdue; }
    public int getHighPriority() { return highPriority; }
    public void setHighPriority(int highPriority) { this.highPriority = highPriority; }
}
