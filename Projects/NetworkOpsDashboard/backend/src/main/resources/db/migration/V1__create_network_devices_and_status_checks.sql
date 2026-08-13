-- V1: core tables for devices and simulated status history

CREATE TABLE network_devices (
    id              BIGSERIAL PRIMARY KEY,
    hostname        VARCHAR(100) NOT NULL,
    ip_address      VARCHAR(45)  NOT NULL,
    device_type     VARCHAR(32)  NOT NULL,
    location        VARCHAR(120) NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'UNKNOWN',
    response_time_ms INTEGER,
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_network_devices_hostname UNIQUE (hostname),
    CONSTRAINT uq_network_devices_ip_address UNIQUE (ip_address)
);

CREATE TABLE status_checks (
    id               BIGSERIAL PRIMARY KEY,
    device_id        BIGINT       NOT NULL REFERENCES network_devices (id) ON DELETE CASCADE,
    status           VARCHAR(32)  NOT NULL,
    response_time_ms INTEGER,
    checked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_network_devices_status ON network_devices (status);
CREATE INDEX idx_network_devices_device_type ON network_devices (device_type);
CREATE INDEX idx_status_checks_device_id_checked_at ON status_checks (device_id, checked_at DESC);
