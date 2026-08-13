package com.networkops.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.networkops.dashboard.dto.DashboardSummaryResponse;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.repository.NetworkDeviceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private NetworkDeviceRepository networkDeviceRepository;

    @InjectMocks
    private DashboardService dashboardService;

    @Test
    void getSummary_aggregatesCountsAndRoundsAverage() {
        when(networkDeviceRepository.count()).thenReturn(5L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.ONLINE)).thenReturn(3L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.OFFLINE)).thenReturn(1L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.DEGRADED)).thenReturn(1L);
        when(networkDeviceRepository.averageResponseTimeMs()).thenReturn(33.333);

        DashboardSummaryResponse summary = dashboardService.getSummary();

        assertThat(summary.getTotalDevices()).isEqualTo(5);
        assertThat(summary.getOnlineDevices()).isEqualTo(3);
        assertThat(summary.getOfflineDevices()).isEqualTo(1);
        assertThat(summary.getDegradedDevices()).isEqualTo(1);
        assertThat(summary.getAverageResponseTimeMs()).isEqualTo(33.33);
    }

    @Test
    void getSummary_handlesNullAverageWhenNoResponseTimes() {
        when(networkDeviceRepository.count()).thenReturn(0L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.ONLINE)).thenReturn(0L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.OFFLINE)).thenReturn(0L);
        when(networkDeviceRepository.countByStatus(DeviceStatus.DEGRADED)).thenReturn(0L);
        when(networkDeviceRepository.averageResponseTimeMs()).thenReturn(null);

        DashboardSummaryResponse summary = dashboardService.getSummary();

        assertThat(summary.getTotalDevices()).isZero();
        assertThat(summary.getAverageResponseTimeMs()).isNull();
    }
}
