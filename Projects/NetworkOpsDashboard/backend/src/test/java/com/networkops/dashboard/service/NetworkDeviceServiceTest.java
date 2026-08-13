package com.networkops.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.networkops.dashboard.dto.DeviceRequest;
import com.networkops.dashboard.dto.DeviceResponse;
import com.networkops.dashboard.dto.PageResponse;
import com.networkops.dashboard.dto.StatusCheckResponse;
import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.entity.StatusCheck;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import com.networkops.dashboard.exception.ConflictException;
import com.networkops.dashboard.exception.ResourceNotFoundException;
import com.networkops.dashboard.repository.NetworkDeviceRepository;
import com.networkops.dashboard.repository.StatusCheckRepository;
import com.networkops.dashboard.support.TestDataFactory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class NetworkDeviceServiceTest {

    @Mock
    private NetworkDeviceRepository networkDeviceRepository;

    @Mock
    private StatusCheckRepository statusCheckRepository;

    @InjectMocks
    private NetworkDeviceService networkDeviceService;

    private DeviceRequest request;

    @BeforeEach
    void setUp() {
        request = TestDataFactory.deviceRequest("core-router-1", "10.0.0.1", DeviceType.ROUTER, "DC1");
    }

    @Test
    void createDevice_savesNewDeviceWithUnknownStatus() {
        when(networkDeviceRepository.existsByHostnameIgnoreCase("core-router-1")).thenReturn(false);
        when(networkDeviceRepository.existsByIpAddress("10.0.0.1")).thenReturn(false);
        when(networkDeviceRepository.save(any(NetworkDevice.class))).thenAnswer(invocation -> {
            NetworkDevice device = invocation.getArgument(0);
            device.setId(1L);
            device.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
            device.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
            return device;
        });

        DeviceResponse response = networkDeviceService.createDevice(request);

        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getHostname()).isEqualTo("core-router-1");
        assertThat(response.getStatus()).isEqualTo(DeviceStatus.UNKNOWN);

        ArgumentCaptor<NetworkDevice> captor = ArgumentCaptor.forClass(NetworkDevice.class);
        verify(networkDeviceRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(DeviceStatus.UNKNOWN);
    }

    @Test
    void createDevice_rejectsDuplicateHostname() {
        when(networkDeviceRepository.existsByHostnameIgnoreCase("core-router-1")).thenReturn(true);

        assertThatThrownBy(() -> networkDeviceService.createDevice(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Hostname already exists");

        verify(networkDeviceRepository, never()).save(any());
    }

    @Test
    void createDevice_rejectsDuplicateIpAddress() {
        when(networkDeviceRepository.existsByHostnameIgnoreCase("core-router-1")).thenReturn(false);
        when(networkDeviceRepository.existsByIpAddress("10.0.0.1")).thenReturn(true);

        assertThatThrownBy(() -> networkDeviceService.createDevice(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("IP address already exists");

        verify(networkDeviceRepository, never()).save(any());
    }

    @Test
    void getDevice_throwsWhenMissing() {
        when(networkDeviceRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> networkDeviceService.getDevice(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void listDevices_filtersByStatus() {
        NetworkDevice online = TestDataFactory.device(1L, "a-router", "10.0.0.1", DeviceType.ROUTER, DeviceStatus.ONLINE);
        when(networkDeviceRepository.findByStatus(eq(DeviceStatus.ONLINE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(online)));

        PageResponse<DeviceResponse> page = networkDeviceService.listDevices(DeviceStatus.ONLINE, null, 0, 20);

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().getFirst().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(page.getTotalElements()).isEqualTo(1);
        verify(networkDeviceRepository).findByStatus(eq(DeviceStatus.ONLINE), any(Pageable.class));
    }

    @Test
    void deleteDevice_removesExistingDevice() {
        NetworkDevice device = TestDataFactory.device(1L, "core-router-1", "10.0.0.1", DeviceType.ROUTER, DeviceStatus.ONLINE);
        when(networkDeviceRepository.findById(1L)).thenReturn(Optional.of(device));

        networkDeviceService.deleteDevice(1L);

        verify(networkDeviceRepository).delete(device);
    }

    @Test
    void recordStatusCheck_updatesDeviceAndStoresHistory() {
        NetworkDevice device = TestDataFactory.device(1L, "core-router-1", "10.0.0.1", DeviceType.ROUTER, DeviceStatus.UNKNOWN);

        networkDeviceService.recordStatusCheck(device, DeviceStatus.ONLINE, 42);

        assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(device.getResponseTimeMs()).isEqualTo(42);
        assertThat(device.getLastCheckedAt()).isNotNull();
        verify(networkDeviceRepository).save(device);

        ArgumentCaptor<StatusCheck> checkCaptor = ArgumentCaptor.forClass(StatusCheck.class);
        verify(statusCheckRepository).save(checkCaptor.capture());
        assertThat(checkCaptor.getValue().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(checkCaptor.getValue().getResponseTimeMs()).isEqualTo(42);
        assertThat(checkCaptor.getValue().getDevice()).isEqualTo(device);
    }

    @Test
    void getDeviceHistory_returnsMappedChecks() {
        NetworkDevice device = TestDataFactory.device(1L, "core-router-1", "10.0.0.1", DeviceType.ROUTER, DeviceStatus.ONLINE);
        StatusCheck check = new StatusCheck();
        check.setId(10L);
        check.setDevice(device);
        check.setStatus(DeviceStatus.DEGRADED);
        check.setResponseTimeMs(200);
        check.setCheckedAt(Instant.parse("2026-01-02T00:00:00Z"));

        when(networkDeviceRepository.findById(1L)).thenReturn(Optional.of(device));
        when(statusCheckRepository.findByDeviceIdOrderByCheckedAtDesc(eq(1L), any(Pageable.class)))
                .thenReturn(List.of(check));

        List<StatusCheckResponse> history = networkDeviceService.getDeviceHistory(1L, 20);

        assertThat(history).hasSize(1);
        assertThat(history.getFirst().getDeviceId()).isEqualTo(1L);
        assertThat(history.getFirst().getStatus()).isEqualTo(DeviceStatus.DEGRADED);
    }
}
