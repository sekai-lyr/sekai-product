package com.sekai.song.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

@Component
@ConditionalOnProperty(name="sekai.deviceSharing.enabled",havingValue="true")
public class DeviceRelay extends AbstractWebSocketHandler implements AutoCloseable {
    private final DeviceSharingService identity;
    private final ObjectMapper json=new ObjectMapper();
    private final Map<String,Peer> sockets=new ConcurrentHashMap<>(),devices=new ConcurrentHashMap<>();
    private final Semaphore streams=new Semaphore(32);
    private final ScheduledExecutorService timer=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"device-heartbeats");t.setDaemon(true);return t;});
    private static final byte[] END=new byte[0];
    public record FileInfo(long songId,String kind,long size,String extension,Long playlistId) {}
    public record Bounds(int status,long start,long length) {}
    public record Metadata(int status,long size,long start,long length,String extension) {}
    public record Source(long songId,String deviceId,String extension,String videoExtension,Long playlistId) {}
    public record State(boolean online,boolean sharing,boolean pending,long bytesSent,int activeStreams) {}
    private static final Map<String,String> MIME=Map.ofEntries(
            Map.entry(".mp3","audio/mpeg"),Map.entry(".flac","audio/flac"),Map.entry(".m4a","audio/mp4"),
            Map.entry(".wav","audio/wav"),Map.entry(".ogg","audio/ogg"),Map.entry(".aac","audio/aac"),Map.entry(".opus","audio/ogg"),
            Map.entry(".mp4","video/mp4"),Map.entry(".webm","video/webm"),Map.entry(".mov","video/quicktime"),
            Map.entry(".lrc","text/plain;charset=UTF-8"),Map.entry(".jpg","image/jpeg"),Map.entry(".jpeg","image/jpeg"),Map.entry(".png","image/png"),Map.entry(".webp","image/webp"));
    private static class Peer {
        final WebSocketSession socket;final Map<String,FileInfo> files=new ConcurrentHashMap<>();
        final Map<String,Transfer> requests=new ConcurrentHashMap<>();final Semaphore slots=new Semaphore(2);
        volatile String id;volatile Long owner;volatile Set<Long> songs=Set.of();
        volatile boolean ready,sharing,desired,blocked,pending;volatile long seen=System.currentTimeMillis(),changed;long version;final AtomicLong bytes=new AtomicLong();
        Peer(WebSocketSession socket){this.socket=socket;}
    }
    public DeviceRelay(DeviceSharingService identity) {
        this.identity=identity;timer.scheduleAtFixedRate(this::sweep,5,5,TimeUnit.SECONDS);
    }
    @Override public void afterConnectionEstablished(WebSocketSession socket) throws Exception {
        if(sockets.size()>=128){socket.close(CloseStatus.SERVICE_OVERLOAD);return;}
        socket.setTextMessageSizeLimit(65536);socket.setBinaryMessageSizeLimit(65572);
        sockets.put(socket.getId(),new Peer(socket));
    }
    @Override protected void handleTextMessage(WebSocketSession socket,TextMessage message) {receive(socket,message.getPayload());}
    public void receive(WebSocketSession socket,String text) {
        Peer peer=sockets.get(socket.getId());if(peer==null)return;
        try {
            if(text.length()>65536)throw new IOException();JsonNode node=json.readTree(text);String type=node.path("type").asText();
            if(peer.owner==null) {
                if(!type.equals("hello"))throw new IOException();
                peer.id=node.path("deviceId").asText();peer.owner=identity.authenticate(peer.id,node.path("token").asText());
                peer.songs=identity.songIds(peer.owner);
                Peer old=devices.put(peer.id,peer);if(old!=null)disconnect(old);
                send(peer,Map.of("type","welcome"));return;
            }
            peer.seen=System.currentTimeMillis();
            switch(type) {
                case "heartbeat" -> {if(!identity.active(peer.id))throw new IOException();send(peer,Map.of("type","heartbeat"));}
                case "catalog" -> {
                    if(peer.ready || !node.path("files").isArray() || node.get("files").size()>256)throw new IOException();
                    for(JsonNode item:node.get("files")) {
                        if(!item.path("songId").isIntegralNumber() || !item.path("size").isIntegralNumber())throw new IOException();
                        long song=item.path("songId").asLong(),size=item.path("size").asLong();
                        String kind=item.path("kind").asText(),extension=item.path("extension").asText();
                        if(!peer.songs.contains(song) || !allowed(kind,extension) || size<0 || size>limit(kind))throw new IOException();
                        Long playlistId=item.path("playlistId").isIntegralNumber() && item.path("playlistId").asLong()>0
                                ? item.path("playlistId").asLong() : null;
                        String key=song+":"+kind;if(peer.files.putIfAbsent(key,new FileInfo(song,kind,size,extension,playlistId))!=null || peer.files.size()>30000)throw new IOException();
                    }send(peer,Map.of("type","catalog-ack"));
                }
                case "catalog-end" -> {peer.ready=true;send(peer,Map.of("type","ready"));}
                case "sharing" -> {
                    synchronized(peer) {
                        if(node.path("version").asLong()==peer.version && peer.pending) {
                            boolean enabled=node.path("enabled").asBoolean();
                            peer.sharing=peer.desired && enabled && !peer.blocked && peer.ready;peer.pending=false;
                            if(!peer.sharing)cancelAll(peer);
                        }
                    }
                }
                case "local-stop" -> {synchronized(peer){peer.blocked=true;peer.desired=false;peer.sharing=false;peer.pending=false;cancelAll(peer);}}
                case "local-resume" -> peer.blocked=false;
                case "meta","end","error" -> response(peer,node,type);
                default -> throw new IOException();
            }
        }catch(Exception error){disconnect(peer);}
    }
    private void response(Peer peer,JsonNode node,String type) throws Exception {
        Transfer transfer=peer.requests.get(node.path("requestId").asText());if(transfer==null)return;
        if(type.equals("error")){transfer.close();return;}
        if(type.equals("end")) {
            Metadata meta=transfer.meta.getNow(null);
            if(meta==null || transfer.received!= (transfer.method.equals("HEAD")?0:meta.length()) || !transfer.queue.offer(END))throw new IOException();
            return;
        }
        if(transfer.meta.isDone())throw new IOException();
        FileInfo file=transfer.file;int status=node.path("status").asInt();
        if(status==404 || status==503){transfer.meta.complete(new Metadata(status,file.size(),0,0,file.extension()));return;}
        Bounds expected=bounds(transfer.range,file.size());
        if(status!=expected.status() || !node.path("size").isIntegralNumber() || node.path("size").asLong()!=file.size()
                || node.path("length").asLong()!=expected.length() || node.path("start").asLong()!=expected.start()
                || !node.path("extension").asText().equals(file.extension()))throw new IOException();
        transfer.meta.complete(new Metadata(status,file.size(),expected.start(),expected.length(),file.extension()));
    }
    @Override protected void handleBinaryMessage(WebSocketSession socket,BinaryMessage message) {
        Peer peer=sockets.get(socket.getId());if(peer==null)return;
        try {
            ByteBuffer data=message.getPayload();if(data.remaining()<37 || data.remaining()>65572)throw new IOException();
            byte[] id=new byte[36];data.get(id);Transfer t=peer.requests.get(new String(id,StandardCharsets.US_ASCII));if(t==null)return;
            Metadata meta=t.meta.getNow(null);if(meta==null || (meta.status()!=200 && meta.status()!=206) || t.method.equals("HEAD"))throw new IOException();
            byte[] bytes=new byte[data.remaining()];data.get(bytes);t.received+=bytes.length;
            if(t.received>meta.length() || !t.queue.offer(bytes))throw new IOException();
        }catch(Exception error){disconnect(peer);}
    }
    @Override public void afterConnectionClosed(WebSocketSession socket,CloseStatus status){Peer peer=sockets.get(socket.getId());if(peer!=null)disconnect(peer);}
    @Override public void handleTransportError(WebSocketSession socket,Throwable error){Peer peer=sockets.get(socket.getId());if(peer!=null)disconnect(peer);}
    private void send(Peer peer,Object message) throws IOException {
        synchronized(peer.socket){
            if(!peer.socket.isOpen())throw new IOException("Device disconnected");
            try{peer.socket.sendMessage(new TextMessage(json.writeValueAsString(message)));}
            catch(IllegalStateException error){throw new IOException("Device disconnected",error);}
        }
    }
    private void cancelAll(Peer peer){for(Transfer t:List.copyOf(peer.requests.values()))t.close();}
    private void disconnect(Peer peer) {
        peer.sharing=false;peer.desired=false;cancelAll(peer);sockets.remove(peer.socket.getId(),peer);
        if(peer.id!=null)devices.remove(peer.id,peer);
        try{peer.socket.close(CloseStatus.POLICY_VIOLATION);}catch(IOException ignored){}
    }
    private void sweep() {
        try {long now=System.currentTimeMillis();for(Peer peer:sockets.values()) {
            if(now-peer.seen>(peer.owner==null?5000:30000)){disconnect(peer);continue;}
            if(peer.pending && now-peer.changed>5000){peer.pending=false;peer.desired=false;peer.sharing=false;cancelAll(peer);}
        }}catch(Exception ignored){}
    }
    public boolean online(String id){Peer p=devices.get(id);return p!=null && p.ready && p.socket.isOpen();}
    public boolean sharing(String id){Peer p=devices.get(id);return online(id) && p.sharing;}
    public State state(String id){Peer p=devices.get(id);return p==null?new State(false,false,false,0,0):new State(online(id),sharing(id),p.pending,p.bytes.get(),p.requests.size());}
    public State toggle(Long owner,String id,boolean enabled) {
        Peer peer=devices.get(id);if(peer==null || !owner.equals(peer.owner))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"设备离线");
        synchronized(peer) {
            if(enabled && (!peer.ready || peer.blocked))throw new ResponseStatusException(HttpStatus.CONFLICT,"请先在电脑端允许共享");
            peer.desired=enabled;peer.sharing=false;peer.pending=true;peer.changed=System.currentTimeMillis();peer.version++;
            cancelAll(peer);
            try{send(peer,Map.of("type","sharing","enabled",enabled,"version",peer.version));}
            catch(IOException error){disconnect(peer);throw new ResponseStatusException(HttpStatus.CONFLICT,"设备离线");}
            return state(id);
        }
    }
    public void disconnect(String id){Peer p=devices.get(id);if(p!=null)disconnect(p);}
    public List<Source> sources(Long owner) {
        List<Source> result=new ArrayList<>();
        for(Peer p:devices.values())if(owner.equals(p.owner) && sharing(p.id))for(FileInfo f:p.files.values())if(f.kind().equals("audio")){
            FileInfo video=p.files.get(f.songId()+":video");
            result.add(new Source(f.songId(),p.id,f.extension(),video==null?null:video.extension(),f.playlistId()));
        }
        return result;
    }
    public Transfer read(Long owner,String id,long song,String kind,String range,String method) {
        Peer p=devices.get(id);if(p==null || !owner.equals(p.owner))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        synchronized(p) {
            if(!sharing(id))throw new ResponseStatusException(HttpStatus.CONFLICT,"设备未共享或离线");
            FileInfo file=p.files.get(song+":"+kind);if(file==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            if(!streams.tryAcquire())throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
            if(!p.slots.tryAcquire()){streams.release();throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);}
            Transfer t=new Transfer(p,file,range,method);p.requests.put(t.id,t);
            try{send(p,new ReadRequest("read",t.id,song,kind,range,method));return t;}
            catch(IOException error){t.close();throw new ResponseStatusException(HttpStatus.CONFLICT,"设备离线");}
        }
    }
    private record ReadRequest(String type,String requestId,long songId,String kind,String range,String method) {}
    public class Transfer implements AutoCloseable {
        final String id=UUID.randomUUID().toString();final Peer peer;final FileInfo file;final String range,method;
        final CompletableFuture<Metadata> meta=new CompletableFuture<>();final ArrayBlockingQueue<byte[]> queue=new ArrayBlockingQueue<>(4);
        final AtomicBoolean closed=new AtomicBoolean();volatile long received;
        Transfer(Peer peer,FileInfo file,String range,String method){this.peer=peer;this.file=file;this.range=range;this.method=method;}
        public Metadata metadata() throws Exception{return meta.get(10,TimeUnit.SECONDS);}
        public byte[] next() throws Exception {byte[] bytes=queue.poll(30,TimeUnit.SECONDS);if(bytes==null || closed.get())throw new IOException("Device transfer stopped");return bytes;}
        public void acknowledge(int length) throws IOException {if(closed.get())throw new IOException();peer.bytes.addAndGet(length);send(peer,Map.of("type","ack","requestId",id));}
        public boolean cancelled(){return closed.get();}
        @Override public void close() {
            if(!closed.compareAndSet(false,true))return;
            peer.requests.remove(id,this);queue.clear();queue.offer(END);meta.completeExceptionally(new IOException("Device transfer stopped"));
            peer.slots.release();streams.release();try{send(peer,Map.of("type","cancel","requestId",id));}catch(IOException ignored){}
        }
    }
    public static String mime(String extension){return MIME.get(extension);}
    private static boolean allowed(String kind,String ext){return MIME.containsKey(ext) && switch(kind){case "audio" -> !Set.of(".lrc",".jpg",".jpeg",".png",".webp").contains(ext);case "video" -> Set.of(".mp4",".webm",".mov").contains(ext);case "lyric" -> ext.equals(".lrc");case "cover" -> Set.of(".jpg",".jpeg",".png",".webp").contains(ext);default -> false;};}
    private static long limit(String kind){return kind.equals("lyric")?262144:kind.equals("cover")?8388608:1099511627776L;}
    public static Bounds bounds(String header,long size) {
        if(header==null || header.isEmpty())return new Bounds(200,0,size);
        Bounds invalid=new Bounds(416,0,0);if(size<=0 || header.length()>128 || !header.matches("bytes=\\d*-\\d*"))return invalid;
        try {
            String[] parts=header.substring(6).split("-",-1);long start,end;
            if(parts[0].isEmpty()){long suffix=Long.parseLong(parts[1]);if(suffix<=0)return invalid;start=Math.max(0,size-suffix);end=size-1;}
            else{start=Long.parseLong(parts[0]);end=parts[1].isEmpty()?size-1:Long.parseLong(parts[1]);if(start>=size || end<start)return invalid;end=Math.min(end,size-1);}
            return new Bounds(206,start,end-start+1);
        }catch(NumberFormatException error){return invalid;}
    }
    @PreDestroy @Override public void close(){timer.shutdownNow();for(Peer p:List.copyOf(sockets.values()))disconnect(p);}
}
