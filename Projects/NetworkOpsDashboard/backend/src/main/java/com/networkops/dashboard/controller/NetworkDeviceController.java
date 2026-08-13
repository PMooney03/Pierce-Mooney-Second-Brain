package com.networkops.dashboard.controller;

import com.networkops.dashboard.dto.DeviceRequest;
import com.networkops.dashboard.dto.DeviceResponse;
import com.networkops.dashboard.dto.PageResponse;
import com.networkops.dashboard.dto.StatusCheckResponse;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import com.networkops.dashboard.service.NetworkDeviceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/devices")
@Validated
@Tag(name = "Devices", description = "Network device registration and monitoring")
public class NetworkDeviceController {

    private final NetworkDeviceService networkDeviceService;

    public NetworkDeviceController(NetworkDeviceService networkDeviceService) {
        this.networkDeviceService = networkDeviceService;
    }

    @GetMapping
    @Operation(summary = "List devices with optional status/type filters and pagination")
    public PageResponse<DeviceResponse> listDevices(
            @RequestParam(required = false) DeviceStatus status,
            @RequestParam(required = false) DeviceType deviceType,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return networkDeviceService.listDevices(status, deviceType, page, size);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single device by id")
    public DeviceResponse getDevice(@PathVariable Long id) {
        return networkDeviceService.getDevice(id);
    }

    @PostMapping
    @Operation(summary = "Register a new network device")
    public ResponseEntity<DeviceResponse> createDevice(@Valid @RequestBody DeviceRequest request) {
        DeviceResponse created = networkDeviceService.createDevice(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing network device")
    public DeviceResponse updateDevice(@PathVariable Long id, @Valid @RequestBody DeviceRequest request) {
        return networkDeviceService.updateDevice(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a network device and its status history")
    public ResponseEntity<Void> deleteDevice(@PathVariable Long id) {
        networkDeviceService.deleteDevice(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Get recent simulated status checks for a device")
    public List<StatusCheckResponse> getHistory(
            @PathVariable Long id,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit
    ) {
        return networkDeviceService.getDeviceHistory(id, limit);
    }
}
