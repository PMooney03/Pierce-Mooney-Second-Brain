package com.networkops.dashboard.repository;

import com.networkops.dashboard.entity.StatusCheck;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StatusCheckRepository extends JpaRepository<StatusCheck, Long> {

    List<StatusCheck> findByDeviceIdOrderByCheckedAtDesc(Long deviceId, Pageable pageable);
}
