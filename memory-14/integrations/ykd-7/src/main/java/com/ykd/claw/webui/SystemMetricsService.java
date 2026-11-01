package com.ykd.claw.webui;

import com.sun.management.OperatingSystemMXBean;
import com.ykd.claw.channel.wechat.ILinkBotService;
import com.ykd.claw.webui.dto.SystemMetrics;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;

/** JVM / 数据库 / 渠道的系统健康指标。 */
@Service
public class SystemMetricsService {

    private final ILinkBotService ilinkBotService;

    public SystemMetricsService(ILinkBotService ilinkBotService) {
        this.ilinkBotService = ilinkBotService;
    }

    public SystemMetrics metrics() {
        var memory = ManagementFactory.getMemoryMXBean();
        var runtime = ManagementFactory.getRuntimeMXBean();
        long heapUsed = memory.getHeapMemoryUsage().getUsed();
        long heapMax = memory.getHeapMemoryUsage().getMax();
        long nonHeap = memory.getNonHeapMemoryUsage().getUsed();

        Path dbPath = Path.of("openclaw.db").toAbsolutePath().normalize();
        long dbSize = 0;
        try {
            if (Files.exists(dbPath)) {
                dbSize = Files.size(dbPath);
            }
        } catch (Exception ignored) {
            // 文件被占用等情况,按 0 处理
        }

        return new SystemMetrics(
                runtime.getUptime(),
                ManagementFactory.getThreadMXBean().getThreadCount(),
                heapUsed, heapMax, nonHeap,
                readCpu(), dbSize, dbPath.toString(),
                ilinkBotService.isLoggedIn(), ilinkBotService.getState());
    }

    private Double readCpu() {
        try {
            var os = ManagementFactory.getOperatingSystemMXBean();
            if (os instanceof OperatingSystemMXBean sunOs) {
                double cpu = sunOs.getProcessCpuLoad();
                if (cpu >= 0) return cpu;
            }
        } catch (Exception ignored) {
            // 平台不支持时返回 null
        }
        return null;
    }
}
