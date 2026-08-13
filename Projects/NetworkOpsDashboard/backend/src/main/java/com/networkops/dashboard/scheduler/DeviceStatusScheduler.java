package com.networkops.dashboard.scheduler;

import com.networkops.dashboard.entity.NetworkDevice;
import com.networkops.dashboard.service.DeviceStatusSimulator;
import com.networkops.dashboard.service.DeviceStatusSimulator.SimulatedCheck;
import com.networkops.dashboard.service.NetworkDeviceService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DeviceStatusScheduler {

    private static final Logger log = LoggerFactory.getLogger(DeviceStatusScheduler.class);

    private final NetworkDeviceService networkDeviceService;
    private final DeviceStatusSimulator deviceStatusSimulator;

    public DeviceStatusScheduler(
            NetworkDeviceService networkDeviceService,
            DeviceStatusSimulator deviceStatusSimulator
    ) {
        this.networkDeviceService = networkDeviceService;
        this.deviceStatusSimulator = deviceStatusSimulator;
    }

    /**
     * Interval is configured in application.yml (default 30 seconds for local testing).
     */
    @Scheduled(fixedDelayString = "${app.status-check.interval-ms:30000}")
    public void runStatusChecks() {
        List<NetworkDevice> devices = networkDeviceService.findAllDevices();
        if (devices.isEmpty()) {
            return;
        }

        log.info("Running simulated status checks for {} device(s)", devices.size());
        for (NetworkDevice device : devices) {
            SimulatedCheck check = deviceStatusSimulator.simulate(device);
            networkDeviceService.recordStatusCheck(device, check.status(), check.responseTimeMs());
        }
    }
}
