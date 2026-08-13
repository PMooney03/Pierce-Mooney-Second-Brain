package com.networkops.dashboard.service;

import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.enums.DeviceStatus;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/**
 * Produces realistic-looking status/response-time values without contacting real equipment.
 */
@Component
public class DeviceStatusSimulator {

    public SimulatedCheck simulate(NetworkDevice device) {
        int roll = ThreadLocalRandom.current().nextInt(100);

        // Weighted outcomes: mostly online, occasional degraded/offline.
        if (roll < 70) {
            int latency = ThreadLocalRandom.current().nextInt(5, 80);
            return new SimulatedCheck(DeviceStatus.ONLINE, latency);
        }
        if (roll < 85) {
            int latency = ThreadLocalRandom.current().nextInt(120, 400);
            return new SimulatedCheck(DeviceStatus.DEGRADED, latency);
        }
        if (roll < 95) {
            return new SimulatedCheck(DeviceStatus.OFFLINE, null);
        }
        return new SimulatedCheck(DeviceStatus.UNKNOWN, null);
    }

    public record SimulatedCheck(DeviceStatus status, Integer responseTimeMs) {
    }
}
