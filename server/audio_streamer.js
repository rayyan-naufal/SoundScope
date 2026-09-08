const fs = require('fs');
const path = require('path');

const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
};

function streamAudioFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ detail: "Audio file not found" });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "audio/mpeg";

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_) {
    return res.status(404).json({ detail: "Audio file cannot be accessed" });
  }

  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    let start = 0;
    let end = fileSize - 1;

    try {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      if (parts[1]) {
        end = parseInt(parts[1], 10);
      }
      if (end >= fileSize) end = fileSize - 1;
    } catch (_) {
      start = 0;
      end = fileSize - 1;
    }

    if (start >= fileSize || start < 0) {
      res.writeHead(416, {
        "Content-Range": `bytes */${fileSize}`,
      });
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

module.exports = {
  streamAudioFile
};
