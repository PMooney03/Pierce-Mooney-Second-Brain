package com.networkops.dashboard.support;

import com.networkops.dashboard.dto.DeviceRequest;
import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import java.time.Instant;

public final class TestDataFactory {

    private TestDataFactory() {
    }

    public static DeviceRequest deviceRequest(String hostname, String ipAddress, DeviceType type, String location) {
        DeviceRequest request = new DeviceRequest();
        request.setHostname(hostname);
        request.setIpAddress(ipAddress);
        request.setDeviceType(type);
        request.setLocation(location);
        return request;
    }

    public static NetworkDevice device(Long id, String hostname, String ipAddress, DeviceType type, DeviceStatus status) {
        NetworkDevice device = new NetworkDevice();
        device.setId(id);
        device.setHostname(hostname);
        device.setIpAddress(ipAddress);
        device.setDeviceType(type);
        device.setLocation("Lab");
        device.setStatus(status);
        device.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        device.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return device;
    }
}
