package com.networkops.dashboard.service;

import com.networkops.dashboard.dto.DashboardSummaryResponse;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.repository.NetworkDeviceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final NetworkDeviceRepository networkDeviceRepository;

    public DashboardService(NetworkDeviceRepository networkDeviceRepository) {
        this.networkDeviceRepository = networkDeviceRepository;
    }

    public DashboardSummaryResponse getSummary() {
        long total = networkDeviceRepository.count();
        long online = networkDeviceRepository.countByStatus(DeviceStatus.ONLINE);
        long offline = networkDeviceRepository.countByStatus(DeviceStatus.OFFLINE);
        long degraded = networkDeviceRepository.countByStatus(DeviceStatus.DEGRADED);
        Double average = networkDeviceRepository.averageResponseTimeMs();

        Double roundedAverage = average == null ? null : Math.round(average * 100.0) / 100.0;

        return new DashboardSummaryResponse(total, online, offline, degraded, roundedAverage);
    }
}
