package com.networkops.dashboard.repository;

import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface NetworkDeviceRepository extends JpaRepository<NetworkDevice, Long> {

    boolean existsByHostnameIgnoreCase(String hostname);

    boolean existsByIpAddress(String ipAddress);

    boolean existsByHostnameIgnoreCaseAndIdNot(String hostname, Long id);

    boolean existsByIpAddressAndIdNot(String ipAddress, Long id);

    Page<NetworkDevice> findByStatus(DeviceStatus status, Pageable pageable);

    Page<NetworkDevice> findByDeviceType(DeviceType deviceType, Pageable pageable);

    Page<NetworkDevice> findByStatusAndDeviceType(DeviceStatus status, DeviceType deviceType, Pageable pageable);

    long countByStatus(DeviceStatus status);

    @Query("""
            SELECT AVG(d.responseTimeMs)
            FROM NetworkDevice d
            WHERE d.responseTimeMs IS NOT NULL
            """)
    Double averageResponseTimeMs();
}
