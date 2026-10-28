package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.DeviceRelay;
import com.sekai.song.service.DeviceSharingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@ConditionalOnProperty(name="sekai.deviceSharing.enabled",havingValue="true")
public class DeviceMediaControl {
    private final DeviceRelay relay;private final DeviceSharingService identity;
    public DeviceMediaControl(DeviceRelay relay,DeviceSharingService identity){this.relay=relay;this.identity=identity;}
    @RequestMapping(value="/api/device-sharing/media/{device}/{song}/{kind}",method={RequestMethod.GET,RequestMethod.HEAD})
    public void stream(@PathVariable String device,@PathVariable long song,@PathVariable String kind,
            HttpSession session,HttpServletRequest request,HttpServletResponse response) throws IOException {
        if(!(session.getAttribute("loginUser") instanceof User user) || user.getId()==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        identity.requireOwnedSong(user.getId(),song);identity.requireOwnedDevice(user.getId(),device);
        String range=request.getHeader("Range");if(range!=null && range.length()>128)throw new ResponseStatusException(HttpStatus.REQUEST_HEADER_FIELDS_TOO_LARGE);
        response.setHeader("Cache-Control","private, no-store");response.setHeader("X-Accel-Buffering","no");response.setHeader("X-Content-Type-Options","nosniff");
        try(var transfer=relay.read(user.getId(),device,song,kind,range,request.getMethod())) {
            DeviceRelay.Metadata meta=transfer.metadata();
            response.setStatus(meta.status());response.setHeader("Accept-Ranges","bytes");
            if(meta.status()==416){response.setHeader("Content-Range","bytes */"+meta.size());response.setContentLengthLong(0);return;}
            if(meta.status()!=200 && meta.status()!=206){response.setContentLengthLong(0);return;}
            response.setContentType(DeviceRelay.mime(meta.extension()));response.setContentLengthLong(meta.length());
            if(meta.status()==206)response.setHeader("Content-Range","bytes "+meta.start()+"-"+(meta.start()+meta.length()-1)+"/"+meta.size());
            if(request.getMethod().equals("HEAD"))return;
            long written=0;var output=response.getOutputStream();
            while(written<meta.length()) {
                byte[] chunk=transfer.next();if(chunk.length==0)break;
                if(written+chunk.length>meta.length())throw new IOException("Invalid media length");
                output.write(chunk);output.flush();written+=chunk.length;
                try{transfer.acknowledge(chunk.length);}
                catch(IOException error){if(written<meta.length())throw error;}
            }
            if(written!=meta.length())throw new IOException("Incomplete media stream");
        }catch(ResponseStatusException error){throw error;}
        catch(Exception error) {
            if(!response.isCommitted()){response.reset();response.setHeader("Cache-Control","private, no-store");response.sendError(504,"供音设备离线或传输中断");}
            else throw new IOException("Device media transfer interrupted",error);
        }
    }
}
