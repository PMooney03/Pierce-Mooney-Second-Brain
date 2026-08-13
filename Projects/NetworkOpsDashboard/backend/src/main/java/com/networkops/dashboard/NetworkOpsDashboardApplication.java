package com.networkops.dashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NetworkOpsDashboardApplication {

    public static void main(String[] args) {
        SpringApplication.run(NetworkOpsDashboardApplication.class, args);
    }
}
