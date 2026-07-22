package com.sekai.draw.lots.model;

public class FocusStats {
    private int todayMinutes;
    private int weekMinutes;
    private int totalSessions;
    private int todaySessions;
    private int activeDays;

    public String getTodayHoursText() {
        return formatMinutes(todayMinutes);
    }

    public String getWeekHoursText() {
        return formatMinutes(weekMinutes);
    }

    private String formatMinutes(int minutes) {
        if (minutes < 60) {
            return minutes + " 分钟";
        }
        int hours = minutes / 60;
        int rest = minutes % 60;
        return rest == 0 ? hours + " 小时" : hours + " 小时 " + rest + " 分钟";
    }

    public int getTodayMinutes() { return todayMinutes; }
    public void setTodayMinutes(int todayMinutes) { this.todayMinutes = todayMinutes; }
    public int getWeekMinutes() { return weekMinutes; }
    public void setWeekMinutes(int weekMinutes) { this.weekMinutes = weekMinutes; }
    public int getTotalSessions() { return totalSessions; }
    public void setTotalSessions(int totalSessions) { this.totalSessions = totalSessions; }
    public int getTodaySessions() { return todaySessions; }
    public void setTodaySessions(int todaySessions) { this.todaySessions = todaySessions; }
    public int getActiveDays() { return activeDays; }
    public void setActiveDays(int activeDays) { this.activeDays = activeDays; }
}
