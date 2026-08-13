package com.networkops.dashboard.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.networkops.dashboard.dto.DeviceRequest;
import com.networkops.dashboard.dto.DeviceResponse;
import com.networkops.dashboard.dto.PageResponse;
import com.networkops.dashboard.enums.DeviceStatus;
import com.networkops.dashboard.enums.DeviceType;
import com.networkops.dashboard.exception.ConflictException;
import com.networkops.dashboard.exception.GlobalExceptionHandler;
import com.networkops.dashboard.exception.ResourceNotFoundException;
import com.networkops.dashboard.service.NetworkDeviceService;
import com.networkops.dashboard.support.TestDataFactory;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = NetworkDeviceController.class)
@Import(GlobalExceptionHandler.class)
class NetworkDeviceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private NetworkDeviceService networkDeviceService;

    @Test
    void createDevice_returns201() throws Exception {
        DeviceRequest request = TestDataFactory.deviceRequest("edge-fw-1", "10.0.0.5", DeviceType.FIREWALL, "DC1");
        when(networkDeviceService.createDevice(any(DeviceRequest.class))).thenReturn(sampleResponse(1L, request));

        mockMvc.perform(post("/api/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.hostname").value("edge-fw-1"))
                .andExpect(jsonPath("$.deviceType").value("FIREWALL"));
    }

    @Test
    void createDevice_returns409WhenHostnameTaken() throws Exception {
        DeviceRequest request = TestDataFactory.deviceRequest("core-router-1", "10.0.0.1", DeviceType.ROUTER, "DC1");
        when(networkDeviceService.createDevice(any(DeviceRequest.class)))
                .thenThrow(new ConflictException("Hostname already exists: core-router-1"));

        mockMvc.perform(post("/api/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Hostname already exists: core-router-1"));
    }

    @Test
    void createDevice_returns400WhenValidationFails() throws Exception {
        String invalidJson = """
                {
                  "hostname": "",
                  "ipAddress": "not-an-ip",
                  "deviceType": "ROUTER",
                  "location": ""
                }
                """;

        mockMvc.perform(post("/api/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.details").isArray());
    }

    @Test
    void getDevice_returns404WhenMissing() throws Exception {
        when(networkDeviceService.getDevice(99L))
                .thenThrow(new ResourceNotFoundException("Device not found with id 99"));

        mockMvc.perform(get("/api/devices/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Device not found with id 99"));
    }

    @Test
    void listDevices_passesFiltersToService() throws Exception {
        PageResponse<DeviceResponse> page = new PageResponse<>(List.of(), 0, 20, 0, 0);
        when(networkDeviceService.listDevices(DeviceStatus.ONLINE, DeviceType.SWITCH, 0, 20)).thenReturn(page);

        mockMvc.perform(get("/api/devices")
                        .param("status", "ONLINE")
                        .param("deviceType", "SWITCH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));

        verify(networkDeviceService).listDevices(DeviceStatus.ONLINE, DeviceType.SWITCH, 0, 20);
    }

    @Test
    void updateDevice_returns200() throws Exception {
        DeviceRequest request = TestDataFactory.deviceRequest("core-router-1", "10.0.0.1", DeviceType.ROUTER, "DC2");
        when(networkDeviceService.updateDevice(eq(1L), any(DeviceRequest.class)))
                .thenReturn(sampleResponse(1L, request));

        mockMvc.perform(put("/api/devices/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location").value("DC2"));
    }

    @Test
    void deleteDevice_returns204() throws Exception {
        mockMvc.perform(delete("/api/devices/1"))
                .andExpect(status().isNoContent());

        verify(networkDeviceService).deleteDevice(1L);
    }

    @Test
    void deleteDevice_returns404WhenMissing() throws Exception {
        doThrow(new ResourceNotFoundException("Device not found with id 1"))
                .when(networkDeviceService).deleteDevice(1L);

        mockMvc.perform(delete("/api/devices/1"))
                .andExpect(status().isNotFound());
    }

    private DeviceResponse sampleResponse(Long id, DeviceRequest request) {
        DeviceResponse response = new DeviceResponse();
        response.setId(id);
        response.setHostname(request.getHostname());
        response.setIpAddress(request.getIpAddress());
        response.setDeviceType(request.getDeviceType());
        response.setLocation(request.getLocation());
        response.setStatus(DeviceStatus.UNKNOWN);
        response.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        response.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return response;
    }
}
