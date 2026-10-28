/** Only a single bounded byte range is supported; multipart responses are rejected. */
export function mediaRange(header,size) {
    if(!Number.isSafeInteger(size) || size<0 || size>1024**4)throw Error('Invalid media size');
    if(header===undefined || header===null || header==='')return {status:200,start:0,end:size-1,length:size};
    const invalid={status:416};
    if(typeof header!=='string' || header.length>128 || !size)return invalid;
    const match=/^bytes=(\d*)-(\d*)$/.exec(header);
    if(!match || (!match[1] && !match[2]))return invalid;
    let start,end;
    if(!match[1]) {
        const suffix=Number(match[2]);
        if(!Number.isSafeInteger(suffix) || suffix<=0)return invalid;
        start=Math.max(0,size-suffix);end=size-1;
    }else {
        start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
        if(!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start>=size || end<start)return invalid;
        end=Math.min(end,size-1);
    }
    return {status:206,start,end,length:end-start+1};
}
