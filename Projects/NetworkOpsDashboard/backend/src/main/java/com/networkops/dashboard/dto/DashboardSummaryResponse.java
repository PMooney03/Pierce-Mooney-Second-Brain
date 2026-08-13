package com.networkops.dashboard.dto;

public class DashboardSummaryResponse {

    private long totalDevices;
    private long onlineDevices;
    private long offlineDevices;
    private long degradedDevices;
    private Double averageResponseTimeMs;

    public DashboardSummaryResponse() {
    }

    public DashboardSummaryResponse(
            long totalDevices,
            long onlineDevices,
            long offlineDevices,
            long degradedDevices,
            Double averageResponseTimeMs
    ) {
        this.totalDevices = totalDevices;
        this.onlineDevices = onlineDevices;
        this.offlineDevices = offlineDevices;
        this.degradedDevices = degradedDevices;
        this.averageResponseTimeMs = averageResponseTimeMs;
    }

    public long getTotalDevices() {
        return totalDevices;
    }

    public void setTotalDevices(long totalDevices) {
        this.totalDevices = totalDevices;
    }

    public long getOnlineDevices() {
        return onlineDevices;
    }

    public void setOnlineDevices(long onlineDevices) {
        this.onlineDevices = onlineDevices;
    }

    public long getOfflineDevices() {
        return offlineDevices;
    }

    public void setOfflineDevices(long offlineDevices) {
        this.offlineDevices = offlineDevices;
    }

    public long getDegradedDevices() {
        return degradedDevices;
    }

    public void setDegradedDevices(long degradedDevices) {
        this.degradedDevices = degradedDevices;
    }

    public Double getAverageResponseTimeMs() {
        return averageResponseTimeMs;
    }

    public void setAverageResponseTimeMs(Double averageResponseTimeMs) {
        this.averageResponseTimeMs = averageResponseTimeMs;
    }
}
