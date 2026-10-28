# Device sharing protocol v1

Integration contract for parallel implementation, 2026-10-22. All endpoints are feature-gated. Browser routes use the existing authenticated session; writes use X-Local-Library-CSRF obtained from GET /local-player/library.

## HTTP

- POST /api/device-sharing/pairing -> {code,expiresInSeconds}; POST /api/device-sharing/pair {code,name} -> {deviceId,token} (existing).
- GET /api/device-sharing/device-library, headers X-Device-Id and Authorization: Bearer TOKEN -> {songs:[{id,title,artist,fileName,fileSize,videoFileName}]} for the authenticated device owner. Never store website cookies/password in the client.
- GET /api/device-sharing/devices -> [{id,name,revoked,online,sharing,pending,bytesSent,activeStreams}].
- POST /api/device-sharing/devices/{id}/sharing {enabled:boolean} -> same status record. Turning off immediately rejects and cancels streams. Turning on remains pending until matching client acknowledgment.
- POST /api/device-sharing/devices/{id}/revoke (existing). Revoke also disconnects active channel.
- GET /api/device-sharing/sources -> [{songId,deviceId,extension}] for owned online/shared sources only. extension includes leading dot.
- GET or HEAD /api/device-sharing/media/{deviceId}/{songId}/{kind}, kind audio|lyric|cover. Owner session mandatory, no credential in URL. Range supported for audio; 206/416, Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control private/no-store, X-Accel-Buffering no. Missing source 404, offline/disabled 409, busy 429, timeout 504. Mid-body failure closes stream; never pretend complete.
- GET /device-sharing authenticated settings page; download link /downloads/sekai-device-client.zip. Server package built from tools/device-sharing files (no private credentials).

## WebSocket

WSS /api/device-sharing/channel. Auth within 5 seconds: first text frame {type:"hello",deviceId,token}; reply {type:"welcome"}. No token in URL. Maximum text 64 KiB, binary 65572 bytes. Client persists credentials in its Windows user-protected config, never prints them. HTTPS mandatory except localhost/127.0.0.1 development.

After welcome send {type:"catalog",files:[{songId,kind,size,extension}]} in pages up to 256 records, then {type:"catalog-end"}. Server validates song ownership and kind/size/extension, maximum 30000 entries per device. Each catalog page -> {type:"catalog-ack"}. No file paths cross the network. Catalog completion -> {type:"ready"}; client starts with sharing off, displays ready status.

Heartbeat every 10 s {type:"heartbeat"}; reply {type:"heartbeat"}. Server closes inactive channel after 30 s. Duplicate connection replaces old and starts off.

Server toggle {type:"sharing",enabled:boolean,version:number}; client replies exact {type:"sharing",enabled,version}. Disable aborts streams before ack; local stop sends {type:"local-stop"} and remains stopped (client refuses enable until operator explicitly resumes). Local resume {type:"local-resume"} allows future website enable but does not enable itself. Reconnect never resurrects a manually stopped sharing state. Temporary disconnect reconnects with sharing off (safer than implicit re-enable).

Server read {type:"read",requestId:UUID,songId,kind,range:string|null,method:"GET"|"HEAD"}. Client responds {type:"meta",requestId,status:200|206|404|416|503,size:totalFileSize,start:offset,length:responseLength,extension}; for 416 length=0. Error messages must not contain local paths. Server calculates and validates expected bounds itself.

Binary data = requestId encoded as 36 ASCII bytes + 1..65536 content bytes. Client sends one chunk then awaits {type:"ack",requestId}; ack is sent only after writing/flushing to HTTP recipient (backpressure). Server queue bounded 4 chunks, max 2 requests/device and 32 globally. After exact length: {type:"end",requestId}. HEAD and zero-body response emit meta then end. Server {type:"cancel",requestId} aborts handle/read and ack wait. Client {type:"error",requestId} aborts that stream. A canceled read must not disconnect unrelated streams.

Meta timeout 10 s, no progress timeout 30 s. All callbacks validate current connection identity. Closing, stopping and revoking cancel all associated requests. Tokens/session keys, paths, media bytes never logged. Same account only; relay never writes media to disk or requests arbitrary URLs.
