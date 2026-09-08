import os
from pathlib import Path
from fastapi import HTTPException
from starlette.responses import StreamingResponse

def range_requests_response(request, file_path: str, content_type: str = "audio/mpeg"):
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    file_size = path.stat().st_size
    range_header = request.headers.get("range")
    
    if range_header:
        # e.g., "bytes=0-1024"
        try:
            bytes_range = range_header.replace("bytes=", "").split("-")
            start = int(bytes_range[0])
            end = int(bytes_range[1]) if bytes_range[1] else file_size - 1
            if end >= file_size:
                end = file_size - 1
            chunk_size = (end - start) + 1
        except Exception:
            start = 0
            end = file_size - 1
            chunk_size = file_size
            
        def iterfile():
            with open(path, mode="rb") as f:
                f.seek(start)
                bytes_left = chunk_size
                while bytes_left > 0:
                    read_size = min(bytes_left, 64 * 1024)
                    data = f.read(read_size)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data
                    
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": content_type,
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers)
        
    def iterfile_full():
        with open(path, mode="rb") as f:
            while chunk := f.read(64 * 1024):
                yield chunk
                
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
    }
    return StreamingResponse(iterfile_full(), status_code=200, headers=headers)
