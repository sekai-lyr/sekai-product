package com.ykd.claw.webui;

import com.openilink.auth.LoginCallbacks;
import com.ykd.claw.channel.wechat.ILinkBotService;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 在监测看板上触发微信扫码登录。
 * {@link ILinkBotService#login} 是同步阻塞调用,必须在后台线程执行;
 * 登录进度(二维码 URL / 已扫码 / 过期 / 成功)通过 {@link EventStreamService} 推给看板。
 */
@Service
public class WechatLoginService {

    public enum Phase { IDLE, QR, SCANNED, EXPIRED, LOGGED_IN, ERROR }

    public record WechatLoginState(Phase phase, String qrCodeUrl, String message) {}

    private final ILinkBotService ilinkBotService;
    private final EventStreamService eventStreamService;
    private final AsyncTaskExecutor asyncExecutor;
    private final AtomicReference<WechatLoginState> state =
            new AtomicReference<>(new WechatLoginState(Phase.IDLE, null, null));
    private final AtomicBoolean inProgress = new AtomicBoolean(false);

    public WechatLoginService(ILinkBotService ilinkBotService,
                              EventStreamService eventStreamService,
                              AsyncTaskExecutor asyncExecutor) {
        this.ilinkBotService = ilinkBotService;
        this.eventStreamService = eventStreamService;
        this.asyncExecutor = asyncExecutor;
    }

    public WechatLoginState getState() {
        return state.get();
    }

    /** 触发扫码登录;已在登录中或已登录则直接返回当前状态。 */
    public WechatLoginState startLogin() {
        if (ilinkBotService.isLoggedIn()) {
            state.set(new WechatLoginState(Phase.LOGGED_IN, null, "已登录"));
            return state.get();
        }
        if (!inProgress.compareAndSet(false, true)) {
            return state.get();
        }
        state.set(new WechatLoginState(Phase.QR, null, "正在获取二维码…"));
        asyncExecutor.execute(this::doLogin);
        return state.get();
    }

    public WechatLoginState stopLogin() {
        ilinkBotService.stop();
        state.set(new WechatLoginState(Phase.IDLE, null, null));
        return state.get();
    }

    private void doLogin() {
        try {
            ilinkBotService.login(new LoginCallbacks() {
                @Override
                public void onQRCode(String qrCodeUrl) {
                    state.set(new WechatLoginState(Phase.QR, qrCodeUrl, "请使用微信扫一扫"));
                    eventStreamService.publish("wechat-qr", qrCodeUrl);
                }

                @Override
                public void onScanned() {
                    state.set(new WechatLoginState(Phase.SCANNED, state.get().qrCodeUrl(), "已扫码,请在手机上确认"));
                }

                @Override
                public void onExpired(int attempt, int maxAttempts) {
                    state.set(new WechatLoginState(Phase.EXPIRED, null, "二维码已过期,请重新登录"));
                }
            });
            if (ilinkBotService.isLoggedIn()) {
                state.set(new WechatLoginState(Phase.LOGGED_IN, null, "登录成功"));
            }
        } catch (Exception e) {
            state.set(new WechatLoginState(Phase.ERROR, null, "登录失败: " + e.getMessage()));
        } finally {
            inProgress.set(false);
        }
    }
}
