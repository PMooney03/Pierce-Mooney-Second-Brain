package com.networkops.dashboard.mapper;

import com.networkops.dashboard.dto.StatusCheckResponse;
import com.networkops.dashboard.entity.StatusCheck;

public final class StatusCheckMapper {

    private StatusCheckMapper() {
    }

    public static StatusCheckResponse toResponse(StatusCheck statusCheck) {
        StatusCheckResponse response = new StatusCheckResponse();
        response.setId(statusCheck.getId());
        response.setDeviceId(statusCheck.getDevice().getId());
        response.setStatus(statusCheck.getStatus());
        response.setResponseTimeMs(statusCheck.getResponseTimeMs());
        response.setCheckedAt(statusCheck.getCheckedAt());
        return response;
    }
}
