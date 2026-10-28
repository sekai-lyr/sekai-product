package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.DeviceSharingService;
import com.sekai.song.service.DeviceRelay;
import com.sekai.song.service.LocalLibraryService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/device-sharing")
@ConditionalOnProperty(name="sekai.deviceSharing.enabled",havingValue="true")
public class DeviceSharingControl {
    private final DeviceSharingService service;
    private final DeviceRelay relay;private final LocalLibraryService library;
    public DeviceSharingControl(DeviceSharingService service,DeviceRelay relay,LocalLibraryService library){this.service=service;this.relay=relay;this.library=library;}
    public record PairInput(@NotBlank @Size(min=43,max=43) String code,@NotBlank @Size(max=80) String name) {}
    public record SharingInput(@jakarta.validation.constraints.NotNull Boolean enabled) {}
    public record BrowserInput(@Size(max=36) String deviceId) {}
    @PostMapping("/browser-device")
    public ResponseEntity<DeviceSharingService.Credentials> browserDevice(@RequestBody @Valid BrowserInput input,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String csrf) {
        Long user=mutation(session,csrf);
        var credentials=service.browserDevice(user,input.deviceId());
        relay.disconnect(credentials.deviceId());return privateResponse(credentials);
    }
    public record DeviceState(String id,String name,boolean revoked,boolean online,boolean sharing,boolean pending,long bytesSent,int activeStreams) {}

    @GetMapping("/devices")
    public ResponseEntity<List<DeviceState>> devices(HttpSession session) {
        return privateResponse(service.list(owner(session)).stream().map(d->{var s=relay.state(d.id());return new DeviceState(d.id(),d.name(),d.revoked(),s.online(),s.sharing(),s.pending(),s.bytesSent(),s.activeStreams());}).toList());
    }
    @GetMapping("/sources") public ResponseEntity<List<DeviceRelay.Source>> sources(HttpSession session){return privateResponse(relay.sources(owner(session)));}
    @PostMapping("/devices/{id}/sharing")
    public ResponseEntity<DeviceRelay.State> sharing(@PathVariable String id,@RequestBody @Valid SharingInput input,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String csrf) {
        Long user=mutation(session,csrf);service.requireOwnedDevice(user,id);return privateResponse(relay.toggle(user,id,input.enabled()));
    }
    @GetMapping("/device-library")
    public ResponseEntity<Map<String,Object>> deviceLibrary(@RequestHeader("X-Device-Id") String id,@RequestHeader("Authorization") String bearer) {
        if(!bearer.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        Long user=service.authenticate(id,bearer.substring(7));return privateResponse(Map.of("songs",library.list(user)));
    }
    @PostMapping("/pairing")
    public ResponseEntity<DeviceSharingService.Pairing> pairing(HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String csrf) {
        return privateResponse(service.createPairing(mutation(session,csrf)));
    }
    @PostMapping("/pair")
    public ResponseEntity<DeviceSharingService.Credentials> pair(@RequestBody @Valid PairInput input) {
        return privateResponse(service.pair(input.code(),input.name()));
    }
    @PostMapping("/devices/{id}/revoke")
    public ResponseEntity<Map<String,Boolean>> revoke(@PathVariable String id,HttpSession session,
            @RequestHeader(value="X-Local-Library-CSRF",required=false) String csrf) {
        Long user=mutation(session,csrf);service.requireOwnedDevice(user,id);service.revoke(user,id);relay.disconnect(id);return privateResponse(Map.of("revoked",true));
    }
    private static Long owner(HttpSession session) {
        if(session.getAttribute("loginUser") instanceof User user && user.getId()!=null)return user.getId();
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    private static Long mutation(HttpSession session,String token) {
        Long id=owner(session);
        if(token==null || !token.equals(session.getAttribute("localLibraryCsrf")))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return id;
    }
    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(body);
    }
}
