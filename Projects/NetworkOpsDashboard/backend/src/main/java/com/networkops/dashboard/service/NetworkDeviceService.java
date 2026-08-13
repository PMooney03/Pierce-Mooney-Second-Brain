package com.networkops.dashboard.service;

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
import com.networkops.dashboard.mapper.NetworkDeviceMapper;
import com.networkops.dashboard.mapper.StatusCheckMapper;
import com.networkops.dashboard.repository.NetworkDeviceRepository;
import com.networkops.dashboard.repository.StatusCheckRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class NetworkDeviceService {

    private static final Logger log = LoggerFactory.getLogger(NetworkDeviceService.class);

    private final NetworkDeviceRepository networkDeviceRepository;
    private final StatusCheckRepository statusCheckRepository;

    public NetworkDeviceService(
            NetworkDeviceRepository networkDeviceRepository,
            StatusCheckRepository statusCheckRepository
    ) {
        this.networkDeviceRepository = networkDeviceRepository;
        this.statusCheckRepository = statusCheckRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<DeviceResponse> listDevices(DeviceStatus status, DeviceType deviceType, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "hostname"));
        Page<NetworkDevice> result;

        if (status != null && deviceType != null) {
            result = networkDeviceRepository.findByStatusAndDeviceType(status, deviceType, pageable);
        } else if (status != null) {
            result = networkDeviceRepository.findByStatus(status, pageable);
        } else if (deviceType != null) {
            result = networkDeviceRepository.findByDeviceType(deviceType, pageable);
        } else {
            result = networkDeviceRepository.findAll(pageable);
        }

        List<DeviceResponse> content = result.getContent().stream()
                .map(NetworkDeviceMapper::toResponse)
                .toList();

        return new PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public DeviceResponse getDevice(Long id) {
        return NetworkDeviceMapper.toResponse(findDeviceOrThrow(id));
    }

    public DeviceResponse createDevice(DeviceRequest request) {
        validateUniqueFields(request.getHostname(), request.getIpAddress(), null);
        NetworkDevice saved = networkDeviceRepository.save(NetworkDeviceMapper.toEntity(request));
        log.info("Created device id={} hostname={}", saved.getId(), saved.getHostname());
        return NetworkDeviceMapper.toResponse(saved);
    }

    public DeviceResponse updateDevice(Long id, DeviceRequest request) {
        NetworkDevice device = findDeviceOrThrow(id);
        validateUniqueFields(request.getHostname(), request.getIpAddress(), id);
        NetworkDeviceMapper.applyRequest(device, request);
        NetworkDevice saved = networkDeviceRepository.save(device);
        log.info("Updated device id={}", saved.getId());
        return NetworkDeviceMapper.toResponse(saved);
    }

    public void deleteDevice(Long id) {
        NetworkDevice device = findDeviceOrThrow(id);
        networkDeviceRepository.delete(device);
        log.info("Deleted device id={} hostname={}", id, device.getHostname());
    }

    @Transactional(readOnly = true)
    public List<StatusCheckResponse> getDeviceHistory(Long id, int limit) {
        findDeviceOrThrow(id);
        Pageable pageable = PageRequest.of(0, limit);
        return statusCheckRepository.findByDeviceIdOrderByCheckedAtDesc(id, pageable).stream()
                .map(StatusCheckMapper::toResponse)
                .toList();
    }

    public void recordStatusCheck(NetworkDevice device, DeviceStatus status, Integer responseTimeMs) {
        device.setStatus(status);
        device.setResponseTimeMs(responseTimeMs);
        device.setLastCheckedAt(java.time.Instant.now());
        networkDeviceRepository.save(device);

        StatusCheck check = new StatusCheck();
        check.setDevice(device);
        check.setStatus(status);
        check.setResponseTimeMs(responseTimeMs);
        statusCheckRepository.save(check);
    }

    @Transactional(readOnly = true)
    public List<NetworkDevice> findAllDevices() {
        return networkDeviceRepository.findAll();
    }

    private NetworkDevice findDeviceOrThrow(Long id) {
        return networkDeviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Device not found with id " + id));
    }

    private void validateUniqueFields(String hostname, String ipAddress, Long currentId) {
        boolean hostnameTaken = currentId == null
                ? networkDeviceRepository.existsByHostnameIgnoreCase(hostname.trim())
                : networkDeviceRepository.existsByHostnameIgnoreCaseAndIdNot(hostname.trim(), currentId);

        if (hostnameTaken) {
            throw new ConflictException("Hostname already exists: " + hostname);
        }

        boolean ipTaken = currentId == null
                ? networkDeviceRepository.existsByIpAddress(ipAddress.trim())
                : networkDeviceRepository.existsByIpAddressAndIdNot(ipAddress.trim(), currentId);

        if (ipTaken) {
            throw new ConflictException("IP address already exists: " + ipAddress);
        }
    }
}
