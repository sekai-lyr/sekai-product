package com.sekai.draw.lots.model;

public class WheelSpinResult {
    private WheelOption option;
    private WheelSpinRecord record;
    private String line;

    public WheelSpinResult() {
    }

    public WheelSpinResult(WheelOption option, WheelSpinRecord record, String line) {
        this.option = option;
        this.record = record;
        this.line = line;
    }

    public WheelOption getOption() { return option; }
    public void setOption(WheelOption option) { this.option = option; }
    public WheelSpinRecord getRecord() { return record; }
    public void setRecord(WheelSpinRecord record) { this.record = record; }
    public String getLine() { return line; }
    public void setLine(String line) { this.line = line; }
}
