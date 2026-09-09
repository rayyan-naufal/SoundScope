package com.rayyan.soundscope.player.data.scanner

import android.content.ContentUris
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.rayyan.soundscope.player.data.local.entity.TrackEntity
import com.rayyan.soundscope.player.data.taxonomy.GenreTaxonomy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File

data class ScanProgress(
    val scannedCount: Int = 0,
    val totalCount: Int = 0,
    val currentFileName: String = "",
    val isCompleted: Boolean = false
)

class LocalAudioScanner(private val context: Context) {

    fun scanDeviceAudio(onBatchReady: (suspend (List<TrackEntity>) -> Unit)? = null): Flow<ScanProgress> = flow {
        val tracksToInsert = mutableListOf<TrackEntity>()
        val contentResolver = context.contentResolver

        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.YEAR,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_ADDED
        )

        // Only scan actual music files, duration > 10 seconds to exclude ringtones/UI sounds
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= 10000"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"

        val cursor = contentResolver.query(
            collection,
            projection,
            selection,
            null,
            sortOrder
        )

        val total = cursor?.count ?: 0
        emit(ScanProgress(scannedCount = 0, totalCount = total, isCompleted = false))

        var count = 0
        val mmr = MediaMetadataRetriever()

        cursor?.use { c ->
            val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val dataCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
            val nameCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
            val durationCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val yearCol = c.getColumnIndex(MediaStore.Audio.Media.YEAR)

            while (c.moveToNext()) {
                val id = c.getLong(idCol)
                val path = c.getString(dataCol) ?: ""
                val file = File(path)
                val fileName = c.getString(nameCol) ?: file.name
                var title = c.getString(titleCol) ?: ""
                var artist = c.getString(artistCol) ?: ""
                val album = c.getString(albumCol) ?: "Unknown Album"
                val albumId = c.getLong(albumIdCol)
                val duration = c.getLong(durationCol)
                var year = if (yearCol != -1) c.getInt(yearCol) else 0

                // Fallback clean parsing if title/artist are missing or unknown
                if (title.isBlank() || title.equals("<unknown>", ignoreCase = true)) {
                    val parsed = parseFilenameFallback(fileName)
                    title = parsed.first
                    if (artist.isBlank() || artist.equals("<unknown>", ignoreCase = true)) {
                        artist = parsed.second
                    }
                }
                if (artist.isBlank() || artist.equals("<unknown>", ignoreCase = true)) {
                    artist = "Unknown Artist"
                }

                // Audio URI
                val contentUri = ContentUris.withAppendedId(collection, id)

                // Album Art URI
                val artworkUri = ContentUris.withAppendedId(
                    Uri.parse("content://media/external/audio/albumart"),
                    albumId
                )

                // Deep tag extraction via MediaMetadataRetriever
                var rawGenre: String? = null
                var hasEmbeddedCover = albumId > 0

                try {
                    mmr.setDataSource(context, contentUri)
                    rawGenre = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE)

                    if (year <= 0) {
                        val yearStr = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR)
                            ?: mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)
                        year = parseYear(yearStr)
                    }

                    val embeddedPic = mmr.embeddedPicture
                    if (embeddedPic != null && embeddedPic.isNotEmpty()) {
                        hasEmbeddedCover = true
                    }
                } catch (_: Exception) {
                    // Ignore unreadable audio header
                }

                // Parse extra ID3 tags (TBPM, TXXX:TEMPO, TXXX:SUBGENRE, TXXX:PARENT_GENRE) if available
                val extraTags = parseExtraAudioTags(file)

                // Resolve Genre Hierarchy
                val genreSource = extraTags.genre ?: rawGenre
                val (resolvedParent, resolvedGenre, resolvedSub) = GenreTaxonomy.resolveHierarchy(genreSource)

                val finalParentGenre = extraTags.parentGenre ?: resolvedParent
                val finalGenre = resolvedGenre
                val finalSubGenre = extraTags.subGenre ?: resolvedSub
                val finalTempo = extraTags.tempo
                val decade = GenreTaxonomy.computeDecade(if (year > 0) year else null)

                val track = TrackEntity(
                    mediaStoreId = id,
                    filePath = path,
                    contentUriString = contentUri.toString(),
                    fileName = fileName,
                    title = title.trim(),
                    artist = artist.trim(),
                    album = album.trim(),
                    albumId = albumId,
                    releaseYear = if (year > 0) year else null,
                    decade = decade,
                    parentGenre = finalParentGenre,
                    genre = finalGenre?.trim(),
                    subGenre = finalSubGenre?.trim(),
                    tempo = finalTempo,
                    durationMs = duration,
                    hasCover = hasEmbeddedCover,
                    coverUriString = artworkUri.toString()
                )

                tracksToInsert.add(track)
                count++

                // Batch dispatch to Room
                if (tracksToInsert.size >= 50) {
                    onBatchReady?.invoke(tracksToInsert.toList())
                    tracksToInsert.clear()
                }

                if (count % 25 == 0 || count == total) {
                    emit(
                        ScanProgress(
                            scannedCount = count,
                            totalCount = total,
                            currentFileName = fileName,
                            isCompleted = false
                        )
                    )
                }
            }
        }

        // Flush remaining tracks
        if (tracksToInsert.isNotEmpty()) {
            onBatchReady?.invoke(tracksToInsert.toList())
            tracksToInsert.clear()
        }

        try {
            mmr.release()
        } catch (_: Exception) {}

        emit(
            ScanProgress(
                scannedCount = count,
                totalCount = total,
                currentFileName = "",
                isCompleted = true
            )
        )
    }.flowOn(Dispatchers.IO)

    suspend fun extractAllTracks(): List<TrackEntity> {
        val tracks = mutableListOf<TrackEntity>()
        val contentResolver = context.contentResolver

        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.YEAR
        )

        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= 10000"
        val cursor = contentResolver.query(collection, projection, selection, null, "${MediaStore.Audio.Media.TITLE} ASC")

        cursor?.use { c ->
            val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val dataCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
            val nameCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
            val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
            val durationCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val yearCol = c.getColumnIndex(MediaStore.Audio.Media.YEAR)

            while (c.moveToNext()) {
                val id = c.getLong(idCol)
                val path = c.getString(dataCol) ?: ""
                val file = File(path)
                val fileName = c.getString(nameCol) ?: file.name
                var title = c.getString(titleCol) ?: ""
                var artist = c.getString(artistCol) ?: ""
                val album = c.getString(albumCol) ?: "Unknown Album"
                val albumId = c.getLong(albumIdCol)
                val duration = c.getLong(durationCol)
                val year = if (yearCol != -1) c.getInt(yearCol) else 0

                if (title.isBlank() || title.equals("<unknown>", ignoreCase = true)) {
                    val parsed = parseFilenameFallback(fileName)
                    title = parsed.first
                    if (artist.isBlank() || artist.equals("<unknown>", ignoreCase = true)) {
                        artist = parsed.second
                    }
                }
                if (artist.isBlank() || artist.equals("<unknown>", ignoreCase = true)) {
                    artist = "Unknown Artist"
                }

                val contentUri = ContentUris.withAppendedId(collection, id)
                val artworkUri = ContentUris.withAppendedId(
                    Uri.parse("content://media/external/audio/albumart"),
                    albumId
                )

                val extraTags = parseExtraAudioTags(file)
                val (resolvedParent, resolvedGenre, resolvedSub) = GenreTaxonomy.resolveHierarchy(extraTags.genre)
                val decade = GenreTaxonomy.computeDecade(if (year > 0) year else null)

                tracks.add(
                    TrackEntity(
                        mediaStoreId = id,
                        filePath = path,
                        contentUriString = contentUri.toString(),
                        fileName = fileName,
                        title = title.trim(),
                        artist = artist.trim(),
                        album = album.trim(),
                        albumId = albumId,
                        releaseYear = if (year > 0) year else null,
                        decade = decade,
                        parentGenre = extraTags.parentGenre ?: resolvedParent,
                        genre = (extraTags.genre ?: resolvedGenre)?.trim(),
                        subGenre = (extraTags.subGenre ?: resolvedSub)?.trim(),
                        tempo = extraTags.tempo,
                        durationMs = duration,
                        hasCover = albumId > 0,
                        coverUriString = artworkUri.toString()
                    )
                )
            }
        }
        return tracks
    }

    private fun parseFilenameFallback(fileName: String): Pair<String, String> {
        val nameWithoutExt = fileName.substringBeforeLast(".")
        val cleanName = nameWithoutExt.replace(Regex("^\\d{1,3}[\\s.\\-_]+"), "").trim()

        return if (cleanName.contains(" - ")) {
            val parts = cleanName.split(" - ", limit = 2)
            val artistPart = parts[0].trim()
            val titlePart = parts[1].trim()
            Pair(titlePart, artistPart)
        } else {
            Pair(cleanName, "Unknown Artist")
        }
    }

    private fun parseYear(yearStr: String?): Int {
        if (yearStr.isNullOrBlank()) return 0
        val match = Regex("\\b(19\\d{2}|20\\d{2})\\b").find(yearStr)
        return match?.value?.toIntOrNull() ?: 0
    }

    private data class ExtraTags(
        val tempo: String? = null,
        val subGenre: String? = null,
        val parentGenre: String? = null,
        val genre: String? = null
    )

    private fun parseExtraAudioTags(file: File): ExtraTags {
        if (!file.exists() || !file.canRead() || file.length() < 128) {
            return ExtraTags()
        }

        var tempo: String? = null
        var subGenre: String? = null
        var parentGenre: String? = null
        var genre: String? = null

        try {
            java.io.FileInputStream(file).use { fis ->
                val header = ByteArray(10)
                if (fis.read(header) < 10) return ExtraTags()

                // Check ID3v2 header
                if (header[0] == 'I'.code.toByte() && header[1] == 'D'.code.toByte() && header[2] == '3'.code.toByte()) {
                    val majorVersion = header[3].toInt()
                    val tagSize = ((header[6].toInt() and 0x7F) shl 21) or
                            ((header[7].toInt() and 0x7F) shl 14) or
                            ((header[8].toInt() and 0x7F) shl 7) or
                            (header[9].toInt() and 0x7F)

                    val maxBytesToRead = minOf(tagSize, 65536)
                    val buffer = ByteArray(maxBytesToRead)
                    val bytesRead = fis.read(buffer)
                    var pos = 0

                    while (pos < bytesRead - 10) {
                        if (buffer[pos].toInt() == 0) {
                            pos++
                            continue
                        }

                        val frameId = String(buffer, pos, 4, Charsets.US_ASCII)
                        if (!frameId.all { it.isLetterOrDigit() }) break

                        val frameSize = if (majorVersion >= 4) {
                            ((buffer[pos + 4].toInt() and 0x7F) shl 21) or
                                    ((buffer[pos + 5].toInt() and 0x7F) shl 14) or
                                    ((buffer[pos + 6].toInt() and 0x7F) shl 7) or
                                    (buffer[pos + 7].toInt() and 0x7F)
                        } else {
                            ((buffer[pos + 4].toInt() and 0xFF) shl 24) or
                                    ((buffer[pos + 5].toInt() and 0xFF) shl 16) or
                                    ((buffer[pos + 6].toInt() and 0xFF) shl 8) or
                                    (buffer[pos + 7].toInt() and 0xFF)
                        }

                        pos += 10
                        if (frameSize <= 0 || pos + frameSize > bytesRead) break

                        when (frameId) {
                            "TBPM" -> {
                                val text = readId3String(buffer, pos, frameSize)
                                val bpm = text.replace(Regex("[^0-9.]"), "").toDoubleOrNull()
                                if (bpm != null && bpm > 0) {
                                    tempo = GenreTaxonomy.bpmToTempo(bpm)
                                }
                            }
                            "TXXX" -> {
                                val pair = readTxxxFrame(buffer, pos, frameSize)
                                if (pair != null) {
                                    val (desc, value) = pair
                                    when (desc.uppercase()) {
                                        "TEMPO", "PACE" -> if (tempo == null) tempo = value
                                        "SUBGENRE", "SUB_GENRE" -> if (subGenre == null) subGenre = value
                                        "PARENT_GENRE" -> if (parentGenre == null) parentGenre = value
                                        "GENRE" -> if (genre == null) genre = value
                                    }
                                }
                            }
                            "TCON" -> {
                                if (genre == null) {
                                    genre = GenreTaxonomy.cleanGenre(readId3String(buffer, pos, frameSize))
                                }
                            }
                        }

                        pos += frameSize
                    }
                }
            }
        } catch (_: Exception) {
            // Non-fatal if audio header parsing fails
        }

        return ExtraTags(tempo, subGenre, parentGenre, genre)
    }

    private fun readId3String(buffer: ByteArray, offset: Int, length: Int): String {
        if (length <= 1) return ""
        val encoding = buffer[offset].toInt()
        val textBytes = buffer.copyOfRange(offset + 1, offset + length)
        val charset = when (encoding) {
            1 -> Charsets.UTF_16
            2 -> Charsets.UTF_16BE
            3 -> Charsets.UTF_8
            else -> Charsets.ISO_8859_1
        }
        return String(textBytes, charset).trim().trimEnd('\u0000')
    }

    private fun readTxxxFrame(buffer: ByteArray, offset: Int, length: Int): Pair<String, String>? {
        if (length <= 2) return null
        val encoding = buffer[offset].toInt()
        val textBytes = buffer.copyOfRange(offset + 1, offset + length)
        val charset = when (encoding) {
            1 -> Charsets.UTF_16
            2 -> Charsets.UTF_16BE
            3 -> Charsets.UTF_8
            else -> Charsets.ISO_8859_1
        }
        val fullText = String(textBytes, charset)
        val parts = fullText.split('\u0000')
        return if (parts.size >= 2) {
            Pair(parts[0].trim(), parts[1].trim())
        } else {
            null
        }
    }
}
