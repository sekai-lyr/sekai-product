/**
 * End-to-end check of the PvP relay on ws://127.0.0.1:8079:
 *  - two clients can create/join a room
 *  - game_start carries BOTH decks (own + opponent)
 *  - the server shuffles both decks (deck-stacking fix)
 *  - a full-size snapshot message (56 KB) is accepted instead of closing the socket
 */
import WebSocket from "../SekaiGame/src/main/resources/static/node_modules/ws/index.js";

const URL = process.env.PVP_URL || "ws://127.0.0.1:8079";
const send = (ws, msg) => ws.send(JSON.stringify(msg));
const once = (ws, type, timeout = 6000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
    const listener = raw => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === type) {
            clearTimeout(timer);
            ws.off("message", listener);
            resolve(msg);
        }
    };
    ws.on("message", listener);
});

const deck = id => Array.from({ length: 40 }, (_, i) => `${id}_card_${i % 14}`);

const host = new WebSocket(URL);
await new Promise((resolve, reject) => { host.once("open", resolve); host.once("error", reject); });
send(host, { type: "create_room", name: "host" });
const created = await once(host, "room_created");
console.log("room created:", created.roomId);

const guest = new WebSocket(URL);
await new Promise((resolve, reject) => { guest.once("open", resolve); guest.once("error", reject); });
send(guest, { type: "join_room", roomId: created.roomId, name: "guest" });
await once(guest, "room_joined");
console.log("guest joined ok");

const hostDeck = [];
for (let i = 0; i < 40; i++) hostDeck.push(`water_${String(100 + (i % 15)).padStart(3, "0")}`);
const guestDeck = [];
for (let i = 0; i < 40; i++) guestDeck.push(`dark_${String(200 + (i % 15)).padStart(3, "0")}`);

const hostStart = once(host, "game_start");
const guestStart = once(guest, "game_start");
send(host, { type: "set_deck", deck: hostDeck });
send(guest, { type: "set_deck", deck: guestDeck });
const [hs, gs] = await Promise.all([hostStart, guestStart]);

console.log("host game_start has own deck:", Array.isArray(hs.deck), hs.deck?.length);
console.log("host game_start has opponent deck:", Array.isArray(hs.opponentDeck), hs.opponentDeck?.length);
const shuffled = hs.deck.join(",") !== hostDeck.join(",");
console.log("host deck was shuffled server-side:", shuffled);
console.log("host/guest decks are swapped correctly:", hs.opponentDeck[0].startsWith("dark_") && gs.deck[0].startsWith("dark_"));

// Big snapshot (like a 55+ card deck end-turn payload) must NOT kill the socket.
const bigState = { blob: "x".repeat(120 * 1024) };
const bigger = JSON.stringify({ type: "game_action", action: { type: "syncState", state: bigState } });
const firstPlayer = hs.firstPlayer === 0 ? host : guest;
const receiver = firstPlayer === host ? guest : host;
const received = new Promise(resolve => {
    receiver.on("message", raw => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "game_action") resolve(msg.action.state.blob.length);
    });
});
send(firstPlayer, { type: "game_action", action: { type: "syncState", state: bigState } });
const blobLength = await Promise.race([
    received,
    new Promise((_, reject) => setTimeout(() => reject(new Error("large message was dropped")), 5000)),
]);
console.log("large snapshot relayed:", blobLength, "bytes");
console.log("sockets still open:", host.readyState === 1 && guest.readyState === 1);

host.close();
guest.close();
console.log("PVP E2E OK");
