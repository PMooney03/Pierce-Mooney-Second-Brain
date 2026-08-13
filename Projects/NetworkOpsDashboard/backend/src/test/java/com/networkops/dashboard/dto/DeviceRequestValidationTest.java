package com.networkops.dashboard.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.networkops.dashboard.enums.DeviceType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Direct Bean Validation checks for DeviceRequest (independent of the web layer).
 */
class DeviceRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        factory.close();
    }

    @Test
    void validRequest_hasNoViolations() {
        DeviceRequest request = validRequest();

        Set<ConstraintViolation<DeviceRequest>> violations = validator.validate(request);

        assertThat(violations).isEmpty();
    }

    @Test
    void blankHostname_isRejected() {
        DeviceRequest request = validRequest();
        request.setHostname("  ");

        Set<ConstraintViolation<DeviceRequest>> violations = validator.validate(request);

        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("hostname"));
    }

    @Test
    void invalidIpAddress_isRejected() {
        DeviceRequest request = validRequest();
        request.setIpAddress("999.1.1.1");

        Set<ConstraintViolation<DeviceRequest>> violations = validator.validate(request);

        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("ipAddress"));
    }

    @Test
    void missingDeviceType_isRejected() {
        DeviceRequest request = validRequest();
        request.setDeviceType(null);

        Set<ConstraintViolation<DeviceRequest>> violations = validator.validate(request);

        assertThat(violations).anyMatch(v -> v.getPropertyPath().toString().equals("deviceType"));
    }

    private DeviceRequest validRequest() {
        DeviceRequest request = new DeviceRequest();
        request.setHostname("core-router-1");
        request.setIpAddress("10.0.0.1");
        request.setDeviceType(DeviceType.ROUTER);
        request.setLocation("DC1");
        return request;
    }
}
