/**
 * port-forward-8085.mjs —— 把 8085 转发到 8091。
 *
 * 项目本身跑在 8091（application.yml / 所有验收脚本都用它），
 * 但 ngrok 隧道（https://scrutiny-fringe-parsley.ngrok-free.dev）指向 8085，
 * 于是外部访问拿到 502。与其去动用户已经起好的 ngrok 进程
 * （重启会换掉公网地址），不如在这里补一个纯 TCP 转发，让两边都能用。
 *
 * 用法：node SekaiGame/tools/port-forward-8085.mjs [--from 8085] [--to 8091]
 */
import net from "node:net";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
const FROM = flag("--from", 8085);
const TO = flag("--to", 8091);

const server = net.createServer(client => {
    const upstream = net.connect(TO, "127.0.0.1");
    const close = () => { client.destroy(); upstream.destroy(); };
    client.on("error", close);
    upstream.on("error", close);
    client.pipe(upstream);
    upstream.pipe(client);
});

server.on("error", error => {
    console.error(`[forward] ${FROM} → ${TO} 启动失败：${error.message}`);
    process.exit(1);
});

server.listen(FROM, "127.0.0.1", () => {
    console.log(`[forward] 127.0.0.1:${FROM} → 127.0.0.1:${TO} 已就绪（ngrok 指向 ${FROM}）`);
});
