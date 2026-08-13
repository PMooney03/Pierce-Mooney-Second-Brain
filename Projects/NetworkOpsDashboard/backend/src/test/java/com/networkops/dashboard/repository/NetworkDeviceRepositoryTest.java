package com.networkops.dashboard.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.entity.StatusCheck;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Repository tests against local Docker Compose PostgreSQL.
 * <p>
 * Why not Testcontainers here? On some Windows Docker Desktop setups the Java Docker
 * client cannot talk to the engine even when {@code docker ps} works. Using the Compose
 * Postgres keeps these as real integration tests. GitHub Actions (Linux) can use a
 * Postgres service container the same way later.
 * <p>
 * Prerequisite: {@code docker compose up -d postgres}
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class NetworkDeviceRepositoryTest {

    @DynamicPropertySource
    static void registerDatasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:5432/networkops");
        registry.add("spring.datasource.username", () -> "networkops");
        registry.add("spring.datasource.password", () -> "networkops");
    }

    @Autowired
    private NetworkDeviceRepository networkDeviceRepository;

    @Autowired
    private StatusCheckRepository statusCheckRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void saveAndFindByStatus() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        NetworkDevice online = persistDevice("ap-" + suffix, "10.10.1.1", DeviceType.ACCESS_POINT, DeviceStatus.ONLINE, 20);
        persistDevice("server-" + suffix, "10.10.1.2", DeviceType.SERVER, DeviceStatus.OFFLINE, null);

        Page<NetworkDevice> onlineDevices = networkDeviceRepository.findByStatus(
                DeviceStatus.ONLINE,
                PageRequest.of(0, 50)
        );

        assertThat(onlineDevices.getContent()).extracting(NetworkDevice::getId).contains(online.getId());
        assertThat(networkDeviceRepository.existsByHostnameIgnoreCase("AP-" + suffix)).isTrue();
        assertThat(networkDeviceRepository.countByStatus(DeviceStatus.OFFLINE)).isGreaterThanOrEqualTo(1);
    }

    @Test
    void averageResponseTimeMs_ignoresNullValues() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        persistDevice("r1-" + suffix, "10.10.2.1", DeviceType.ROUTER, DeviceStatus.ONLINE, 10);
        persistDevice("r2-" + suffix, "10.10.2.2", DeviceType.ROUTER, DeviceStatus.ONLINE, 30);
        persistDevice("r3-" + suffix, "10.10.2.3", DeviceType.ROUTER, DeviceStatus.OFFLINE, null);

        Double average = networkDeviceRepository.averageResponseTimeMs();

        assertThat(average).isNotNull();
        assertThat(average).isGreaterThan(0);
    }

    @Test
    void statusChecks_areOrderedNewestFirstAndDeletedWithDevice() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        NetworkDevice device = persistDevice("sw-" + suffix, "10.10.3.1", DeviceType.SWITCH, DeviceStatus.ONLINE, 15);

        StatusCheck older = new StatusCheck();
        older.setDevice(device);
        older.setStatus(DeviceStatus.ONLINE);
        older.setResponseTimeMs(15);
        older.setCheckedAt(Instant.parse("2026-01-01T10:00:00Z"));
        statusCheckRepository.save(older);

        StatusCheck newer = new StatusCheck();
        newer.setDevice(device);
        newer.setStatus(DeviceStatus.DEGRADED);
        newer.setResponseTimeMs(200);
        newer.setCheckedAt(Instant.parse("2026-01-01T11:00:00Z"));
        statusCheckRepository.save(newer);

        List<StatusCheck> history = statusCheckRepository.findByDeviceIdOrderByCheckedAtDesc(
                device.getId(),
                PageRequest.of(0, 10)
        );

        assertThat(history).hasSize(2);
        assertThat(history.getFirst().getStatus()).isEqualTo(DeviceStatus.DEGRADED);

        Long deviceId = device.getId();
        // Clear the persistence context so Hibernate is not still holding StatusCheck -> Device links.
        // Then deleting the device exercises the database ON DELETE CASCADE rule.
        entityManager.flush();
        entityManager.clear();

        networkDeviceRepository.deleteById(deviceId);
        networkDeviceRepository.flush();

        assertThat(statusCheckRepository.findByDeviceIdOrderByCheckedAtDesc(deviceId, PageRequest.of(0, 10)))
                .isEmpty();
    }

    private NetworkDevice persistDevice(
            String hostname,
            String ip,
            DeviceType type,
            DeviceStatus status,
            Integer responseTimeMs
    ) {
        NetworkDevice device = new NetworkDevice();
        device.setHostname(hostname);
        device.setIpAddress(ip);
        device.setDeviceType(type);
        device.setLocation("Test Lab");
        device.setStatus(status);
        device.setResponseTimeMs(responseTimeMs);
        return networkDeviceRepository.saveAndFlush(device);
    }
}
