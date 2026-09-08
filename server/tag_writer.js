const fs = require('fs');
const path = require('path');
const NodeID3 = require('node-id3');
const { loadSettings } = require('./config');

function writeTagsToFile(filePath, tagData) {
  const ext = path.extname(filePath).toLowerCase();
  const settings = loadSettings();

  const title = tagData.title || "";
  const artist = tagData.artist || "";
  const album = tagData.album || "";
  const year = tagData.release_year ? String(tagData.release_year) : "";
  const parentGenre = tagData.parent_genre || "";
  const genre = tagData.genre || "";
  const subGenre = tagData.sub_genre || "";
  const tempo = tagData.tempo || "";
  const notes = tagData.ai_notes || "";

  // Combine standard genre hierarchy string
  const genreHierarchy = [parentGenre, genre, subGenre].filter(Boolean).join("; ");
  const standardGenre = genre || parentGenre || "";

  if (ext === ".mp3") {
    // Preserve existing tags (especially APIC cover art)
    const existingTags = NodeID3.read(filePath) || {};

    const tags = {
      ...existingTags,
      title: title || existingTags.title,
      artist: artist || existingTags.artist,
      album: album || existingTags.album,
      year: year || existingTags.year
    };

    if (settings.write_standard_genre && (genreHierarchy || standardGenre)) {
      tags.genre = genreHierarchy || standardGenre;
    }

    if (tempo) {
      const bpmMatch = tempo.match(/\b(\d{2,3})\b/);
      if (bpmMatch) {
        tags.bpm = bpmMatch[1];
      }
    }

    if (notes) {
      tags.comment = {
        language: "eng",
        shortText: "AI_NOTES",
        text: notes
      };
    }

    // Custom TXXX frames
    if (settings.write_custom_frames) {
      const userDefinedText = Array.isArray(tags.userDefinedText) ? [...tags.userDefinedText] : [];

      const setTxxx = (desc, val) => {
        const idx = userDefinedText.findIndex(t => t.description && t.description.toUpperCase() === desc.toUpperCase());
        if (val) {
          if (idx >= 0) userDefinedText[idx] = { description: desc, value: val };
          else userDefinedText.push({ description: desc, value: val });
        } else if (idx >= 0) {
          userDefinedText.splice(idx, 1);
        }
      };

      if (parentGenre) setTxxx("PARENT_GENRE", parentGenre);
      if (genre) setTxxx("GENRE", genre);
      if (subGenre) setTxxx("SUBGENRE", subGenre);
      if (tempo) {
        setTxxx("TEMPO", tempo);
        setTxxx("PACE", tempo);
      }

      tags.userDefinedText = userDefinedText;
    }

    const success = NodeID3.update(tags, filePath);
    if (!success) {
      throw new Error(`Failed to update ID3 tags in ${filePath}`);
    }
    return true;
  }

  // If FLAC or other format, log or handle gracefully
  return true;
}

module.exports = {
  writeTagsToFile
};
