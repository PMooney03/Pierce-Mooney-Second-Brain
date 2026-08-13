package com.networkops.dashboard.mapper;

import com.networkops.dashboard.dto.DeviceRequest;
import com.networkops.dashboard.dto.DeviceResponse;
import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.enums.DeviceStatus;

/**
 * Manual mapper keeps entity-to-DTO conversion easy to read while learning.
 * MapStruct can replace this later if mapping boilerplate grows.
 */
public final class NetworkDeviceMapper {

    private NetworkDeviceMapper() {
    }

    public static NetworkDevice toEntity(DeviceRequest request) {
        NetworkDevice device = new NetworkDevice();
        applyRequest(device, request);
        device.setStatus(DeviceStatus.UNKNOWN);
        return device;
    }

    public static void applyRequest(NetworkDevice device, DeviceRequest request) {
        device.setHostname(request.getHostname().trim());
        device.setIpAddress(request.getIpAddress().trim());
        device.setDeviceType(request.getDeviceType());
        device.setLocation(request.getLocation().trim());
    }

    public static DeviceResponse toResponse(NetworkDevice device) {
        DeviceResponse response = new DeviceResponse();
        response.setId(device.getId());
        response.setHostname(device.getHostname());
        response.setIpAddress(device.getIpAddress());
        response.setDeviceType(device.getDeviceType());
        response.setLocation(device.getLocation());
        response.setStatus(device.getStatus());
        response.setResponseTimeMs(device.getResponseTimeMs());
        response.setLastCheckedAt(device.getLastCheckedAt());
        response.setCreatedAt(device.getCreatedAt());
        response.setUpdatedAt(device.getUpdatedAt());
        return response;
    }
}
