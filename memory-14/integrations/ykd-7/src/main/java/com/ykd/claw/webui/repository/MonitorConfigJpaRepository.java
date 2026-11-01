package com.ykd.claw.webui.repository;

import com.ykd.claw.webui.entity.MonitorConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonitorConfigJpaRepository extends JpaRepository<MonitorConfigEntity, String> {
}
