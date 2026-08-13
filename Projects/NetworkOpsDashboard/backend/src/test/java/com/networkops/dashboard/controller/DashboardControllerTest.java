package com.networkops.dashboard.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.networkops.dashboard.dto.DashboardSummaryResponse;
import com.networkops.dashboard.exception.GlobalExceptionHandler;
import com.networkops.dashboard.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DashboardController.class)
@Import(GlobalExceptionHandler.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DashboardService dashboardService;

    @Test
    void getSummary_returnsAggregates() throws Exception {
        when(dashboardService.getSummary())
                .thenReturn(new DashboardSummaryResponse(4, 2, 1, 1, 55.5));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalDevices").value(4))
                .andExpect(jsonPath("$.onlineDevices").value(2))
                .andExpect(jsonPath("$.offlineDevices").value(1))
                .andExpect(jsonPath("$.degradedDevices").value(1))
                .andExpect(jsonPath("$.averageResponseTimeMs").value(55.5));
    }
}
