// --- SoundScope — Professional Audio Tool Application Logic ---

const state = {
  tracks: [],
  allTracks: [],
  selectedIds: new Set(),
  activeRowIndex: -1,
  taxonomies: {
    decades: [],
    parent_genres: [],
    genres: [],
    sub_genres: [],
    tempos: [],
    parent_to_genres: {},
    parent_to_subgenres: {},
    genre_to_subgenres: {}
  },
  filters: {
    search: "",
    decade: "All",
    parent_genre: "All",
    genre: "All",
    sub_genre: "All",
    tempo: "All",
    is_liked: "All",
    status: "All"
  },
  sortBy: "id",
  sortOrder: "ASC",
  currentPlayingTrack: null,
  isPlaying: false,
  isShuffle: false,
  loopMode: "all", // "off", "all", "one"
  isMuted: false,
  previousVolume: 0.8,
  audio: null,
  currentMusicDir: "",
  modelCascade: ["gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-3.7-flash"],
  appMode: localStorage.getItem("soundscope_app_mode") || localStorage.getItem("sonictag_app_mode") || "studio",
  playerView: "home",
  activePlaylistId: null,
  activeFilterValue: null,
  playlists: [],
  queue: [],
  contextTrack: null,
  playHistory: []
};
window.state = state;
let analysisCompleteAudioContext = null;

function playAnalysisCompleteSound() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  if (!analysisCompleteAudioContext) {
    analysisCompleteAudioContext = new AudioCtor();
  }

  const ctx = analysisCompleteAudioContext;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Spotify-ish soft success chime: two short rising tones with a gentle envelope.
  const playTone = (freq, start, duration, type = "sine", gainValue = 0.04) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  };

  playTone(523.25, now, 0.16, "triangle", 0.045);
  playTone(659.25, now + 0.08, 0.18, "sine", 0.035);
  playTone(783.99, now + 0.16, 0.24, "sine", 0.03);
}

// Lucide SVG Icons Cache (16px / 14px / 12px, stroke 1.5)
const ICONS = {
  play: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  sparkles: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1 1.3-1.3Z"/></svg>`,
  headphones: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`,
  pencil: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  save: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>`,
  disc: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>`,
  check: `<svg class="lucide" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  volume2: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  volumeX: `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>`
};

// DOM Elements
const openFolderModalBtn = document.getElementById("openFolderModalBtn");
const headerFolderDisplay = document.getElementById("headerFolderDisplay");
const scanBtn = document.getElementById("scanBtn");
const clearLibraryBtn = document.getElementById("clearLibraryBtn");

// Folder Selection Modal Elements
const folderModalBackdrop = document.getElementById("folderModalBackdrop");
const closeFolderModalBtn = document.getElementById("closeFolderModalBtn");
const cancelFolderModalBtn = document.getElementById("cancelFolderModalBtn");
const modalFolderInput = document.getElementById("modalFolderInput");
const modalBrowseWindowsBtn = document.getElementById("modalBrowseWindowsBtn");
const presetTestFolderBtn = document.getElementById("presetTestFolderBtn");
const presetMusicFolderBtn = document.getElementById("presetMusicFolderBtn");
const modalClearPreviousCheckbox = document.getElementById("modalClearPreviousCheckbox");
const modalScanNowBtn = document.getElementById("modalScanNowBtn");

// Search & Filters
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const genreFilter = document.getElementById("genreFilter");
const subGenreFilter = document.getElementById("subGenreFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const resetDecadeBtn = document.getElementById("resetDecadeBtn");
const resetGenreBtn = document.getElementById("resetGenreBtn");

// Filter Rail Lists
const statusRailList = document.getElementById("statusRailList");
const decadeRailList = document.getElementById("decadeRailList");
const parentGenreRailList = document.getElementById("parentGenreRailList");
const sidebarAnalyzeTempoCheckbox = document.getElementById("sidebarAnalyzeTempoCheckbox");

// Toolbar Elements
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const selectedCountText = document.getElementById("selectedCountText");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const analyzeSelectedBtn = document.getElementById("analyzeSelectedBtn");
const batchTagUntaggedBtn = document.getElementById("batchTagUntaggedBtn");
const batchTagUntaggedLabel = document.getElementById("batchTagUntaggedLabel");
const applySelectedBtn = document.getElementById("applySelectedBtn");
const displayCountText = document.getElementById("displayCountText");
const playAllBtn = document.getElementById("playAllBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

// Table
const tracksTableBody = document.getElementById("tracksTableBody");
const tableStateOverlay = document.getElementById("tableStateOverlay");

// Top Nav Stats & API status
const statTotal = document.getElementById("statTotal");
const statUnprocessed = document.getElementById("statUnprocessed");
const statAnalyzed = document.getElementById("statAnalyzed");
const statSaved = document.getElementById("statSaved");
const navApiDot = document.getElementById("navApiDot");
const navApiLabel = document.getElementById("navApiLabel");

// Rail Counts
const countStatusAll = document.getElementById("countStatusAll");
const countStatusUntagged = document.getElementById("countStatusUntagged");
const countStatusAnalyzed = document.getElementById("countStatusAnalyzed");
const countStatusSaved = document.getElementById("countStatusSaved");

// Player Elements
const playerCover = document.getElementById("playerCover");
const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");
const playerPlayPauseBtn = document.getElementById("playerPlayPauseBtn");
const playIconSvg = document.getElementById("playIconSvg");
const playerPrevBtn = document.getElementById("playerPrevBtn");
const playerNextBtn = document.getElementById("playerNextBtn");
const playerShuffleToggleBtn = document.getElementById("playerShuffleToggleBtn");
const playerLoopBtn = document.getElementById("playerLoopBtn");
const playerMuteBtn = document.getElementById("playerMuteBtn");
const volIconSvg = document.getElementById("volIconSvg");
const playerProgressBar = document.getElementById("playerProgressBar");
const playerCurrentTime = document.getElementById("playerCurrentTime");
const playerTotalTime = document.getElementById("playerTotalTime");
const playerVolumeBar = document.getElementById("playerVolumeBar");
const nativeAudio = document.getElementById("nativeAudioElement");

// Mode Switcher Elements
const modeStudioBtn = document.getElementById("modeStudioBtn");
const modePlayerBtn = document.getElementById("modePlayerBtn");
const studioModeView = document.getElementById("studioModeView");
const playerModeView = document.getElementById("playerModeView");

// Spotify Player Elements
const spNavHomeBtn = document.getElementById("spNavHomeBtn");
const spNavAllTracksBtn = document.getElementById("spNavAllTracksBtn");
const spNavLikedBtn = document.getElementById("spNavLikedBtn");
const spLikedCountBadge = document.getElementById("spLikedCountBadge");
const spNavArtistsBtn = document.getElementById("spNavArtistsBtn");
const spNavAlbumsBtn = document.getElementById("spNavAlbumsBtn");
const spNavDecadesBtn = document.getElementById("spNavDecadesBtn");
const spNavGenresBtn = document.getElementById("spNavGenresBtn");
const spNavTempoBtn = document.getElementById("spNavTempoBtn");
const spCreatePlaylistBtn = document.getElementById("spCreatePlaylistBtn");
const spPlaylistList = document.getElementById("spPlaylistList");
const spContentScroll = document.getElementById("spContentScroll");

// Player Bar Extra Buttons
const playerLikeBtn = document.getElementById("playerLikeBtn");
const playerLikeIcon = document.getElementById("playerLikeIcon");

// Queue Elements
const navQueueBtn = document.getElementById("navQueueBtn");
const playerQueueToggleBtn = document.getElementById("playerQueueToggleBtn");
const spQueueDrawer = document.getElementById("spQueueDrawer");
const spQueueCloseBtn = document.getElementById("spQueueCloseBtn");
const spQueueClearBtn = document.getElementById("spQueueClearBtn");
const queueNowPlayingItem = document.getElementById("queueNowPlayingItem");
const queueUpNextList = document.getElementById("queueUpNextList");

// Playlist Modal Elements
const newPlaylistModalBackdrop = document.getElementById("newPlaylistModalBackdrop");
const closeNewPlaylistModalBtn = document.getElementById("closeNewPlaylistModalBtn");
const cancelNewPlaylistBtn = document.getElementById("cancelNewPlaylistBtn");
const submitNewPlaylistBtn = document.getElementById("submitNewPlaylistBtn");
const newPlaylistNameInput = document.getElementById("newPlaylistNameInput");
const newPlaylistDescInput = document.getElementById("newPlaylistDescInput");

// Floating Context Menu
const spContextMenu = document.getElementById("spContextMenu");
const ctxPlayNext = document.getElementById("ctxPlayNext");
const ctxAddToQueue = document.getElementById("ctxAddToQueue");
const ctxToggleLike = document.getElementById("ctxToggleLike");
const ctxToggleLikeIcon = document.getElementById("ctxToggleLikeIcon");
const ctxToggleLikeText = document.getElementById("ctxToggleLikeText");
const ctxAddToPlaylistParent = document.getElementById("ctxAddToPlaylistParent");
const ctxOpenInStudio = document.getElementById("ctxOpenInStudio");

// Modals
const editModal = document.getElementById("editModalBackdrop");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");
const saveAndWriteFileBtn = document.getElementById("saveAndWriteFileBtn");

const settingsModal = document.getElementById("settingsModalBackdrop");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsLanguage = document.getElementById("settingsLanguage");
const settingsApiKey = document.getElementById("settingsApiKey");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const settingsSeparator = document.getElementById("settingsSeparator");
const settingsWriteCustom = document.getElementById("settingsWriteCustom");
const settingsAnalyzeTempo = document.getElementById("settingsAnalyzeTempo");
const editTempo = document.getElementById("editTempo");
const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
const cascadeFlowPreview = document.getElementById("cascadeFlowPreview");
const modelSelectionList = document.getElementById("modelSelectionList");
const presetUltraFastBtn = document.getElementById("presetUltraFastBtn");
const presetBalancedBtn = document.getElementById("presetBalancedBtn");
const presetMaxQualityBtn = document.getElementById("presetMaxQualityBtn");

const AVAILABLE_MODELS = [
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    tierClass: "tier-lite",
    tierName: "High Quota Lite",
    quotaBadge: "⚡ Ultra-Fast / Fresh Quota",
    desc_en: "Ultra-fast generation & low token cost with separate fresh daily quota.",
    desc_id: "Generasi sangat cepat & hemat token dengan kuota harian segar terpisah."
  },
  {
    id: "gemini-flash-lite-latest",
    name: "Gemini Flash Lite Latest",
    tierClass: "tier-lite",
    tierName: "Auto Lite",
    quotaBadge: "⚡ Latest Lite",
    desc_en: "Always points to Google's latest active Flash Lite model.",
    desc_id: "Selalu menggunakan model Flash Lite aktif terbaru dari Google."
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    tierClass: "tier-mid",
    tierName: "Flash Preview",
    quotaBadge: "Fresh Quota",
    desc_en: "Next-generation Flash model preview with active quota.",
    desc_id: "Model Flash generasi baru dengan kuota aktif."
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    tierClass: "tier-lite",
    tierName: "Default / Fast Lite",
    quotaBadge: "⚡ 1.4s / 500 RPD",
    desc_en: "Ultra-fast (~1.4s) & lowest token usage. Best and default choice for large batch tagging.",
    desc_id: "Model default tercepat (~1.4s) & paling hemat token. Pilihan utama untuk batch tagging besar."
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    tierClass: "tier-mid",
    tierName: "Mid Tier",
    quotaBadge: "15 RPM / High Quota",
    desc_en: "Workhorse industry standard. Solid taxonomy depth with high daily quota.",
    desc_id: "Model standar serbaguna yang solid dengan jatah kuota harian tinggi."
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    tierClass: "tier-high",
    tierName: "High Tier",
    quotaBadge: "5 RPM / 20 RPD",
    desc_en: "Highest accuracy with musical reasoning. Free tier limited to 20 RPD.",
    desc_id: "Akurasi penalaran musik tertinggi. Kuota free tier dibatasi 20 RPD."
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tierClass: "tier-high",
    tierName: "Fast",
    quotaBadge: "High-Speed",
    desc_en: "Fast and stable Flash generation with good taxonomy recall.",
    desc_id: "Varian Flash berkecepatan tinggi yang stabil dan konsisten."
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    tierClass: "tier-high",
    tierName: "Reasoning",
    quotaBadge: "Preview",
    desc_en: "Fast reasoning Flash preview variant.",
    desc_id: "Varian Flash dengan kemampuan penalaran cepat."
  },
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash Latest",
    tierClass: "tier-mid",
    tierName: "Auto Alias",
    quotaBadge: "Latest",
    desc_en: "Automatically points to Google's latest stable Flash model.",
    desc_id: "Secara otomatis merujuk ke model Flash stabil terbaru dari Google."
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    tierClass: "tier-pro",
    tierName: "Pro Flagship",
    quotaBadge: "Paid Tier",
    desc_en: "Flagship deep reasoning Pro model. (Requires Google Cloud billing).",
    desc_id: "Model penalaran mendalam seri Pro. (Perlu billing Google Cloud)."
  }
];

const progressModal = document.getElementById("progressModalBackdrop");
const progressModalIcon = document.getElementById("progressModalIcon");
const progressModalTitle = document.getElementById("progressModalTitle");
const progressModalDesc = document.getElementById("progressModalDesc");
const batchProgressFill = document.getElementById("batchProgressFill");
const progressCount = document.getElementById("progressCount");
const progressRemaining = document.getElementById("progressRemaining");
const progressElapsed = document.getElementById("progressElapsed");
const progressElapsedLabel = document.getElementById("progressElapsedLabel");
const progressEta = document.getElementById("progressEta");
const progressStatusText = document.getElementById("progressStatusText");
const progressStatusBadge = document.getElementById("progressStatusBadge");
const cancelProgressBtn = document.getElementById("cancelProgressBtn");
const saveAnalyzedAndStopBtn = document.getElementById("saveAnalyzedAndStopBtn");
const saveAnalyzedBtnText = document.getElementById("saveAnalyzedBtnText");
const closeProgressBtn = document.getElementById("closeProgressBtn");
const minimizeProgressBtn = document.getElementById("minimizeProgressBtn");
const minimizedBatchProgress = document.getElementById("minimizedBatchProgress");
const minimizedBatchProgressText = document.getElementById("minimizedBatchProgressText");
const toastContainer = document.getElementById("toastContainer");

function resetSaveAnalyzedButtonUI(labelText = null) {
  if (!saveAnalyzedAndStopBtn) return;
  const count = currentBatchAnalyzedIds ? currentBatchAnalyzedIds.length : 0;
  const text = labelText ?? t("progress_save_analyzed_btn", { n: count });
  saveAnalyzedAndStopBtn.disabled = false;
  saveAnalyzedAndStopBtn.style.display = count > 0 ? "inline-flex" : "none";
  saveAnalyzedAndStopBtn.innerHTML = `${ICONS.save} <span id="saveAnalyzedBtnText">${text}</span>`;
  if (saveAnalyzedBtnText) {
    saveAnalyzedBtnText.textContent = text;
  }
}

function formatStopwatch(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatReadableRuntime(seconds, lang = "id") {
  const sec = Math.max(0, Math.round(seconds));
  if (sec < 60) {
    return lang === "id" ? `${sec} detik` : `${sec}s`;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) {
    return lang === "id" ? `${m} menit` : `${m}m`;
  }
  return lang === "id" ? `${m}m ${s < 10 ? '0' : ''}${s}d` : `${m}m ${s < 10 ? '0' : ''}${s}s`;
}

function formatEtaTime(seconds) {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `~${m}m ${s < 10 ? '0' : ''}${s}s`;
}

const PROGRESS_ICONS = {
  spinner: `<svg class="lucide" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1.2s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
  completed: `<svg class="lucide" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  cancelled: `<svg class="lucide" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
};

let activeAnalysisAbortController = null;
let isAnalysisCancelled = false;

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initAudio();
  initEventListeners();
  initPlayerMode();
  loadInitialData();
});

function initEventListeners() {
  // Sidebar state persistence on load
  const appContainer = document.querySelector(".app-container");
  const isSidebarCollapsed = (localStorage.getItem("soundscope_sidebar_collapsed") || localStorage.getItem("sonictag_sidebar_collapsed")) === "true";
  if (isSidebarCollapsed && appContainer) {
    appContainer.classList.add("sidebar-collapsed");
  }

  // Keyboard navigation & shortcuts
  document.addEventListener("keydown", (e) => {
    const isEditing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);

    // Ctrl+B: Toggle Sidebar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      window.handleToggleSidebar();
      return;
    }

    // Ctrl+K: Focus Search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchInput) searchInput.focus();
      return;
    }

    // Escape: Close active modal
    if (e.key === "Escape") {
      if (editModal && editModal.style.display !== "none") editModal.style.display = "none";
      if (settingsModal && settingsModal.style.display !== "none") settingsModal.style.display = "none";
      if (folderModalBackdrop && folderModalBackdrop.style.display !== "none") folderModalBackdrop.style.display = "none";
      if (progressModal && progressModal.style.display !== "none" && closeProgressBtn.style.display !== "none") progressModal.style.display = "none";
      return;
    }

    if (isEditing) return;

    // Space: Play / Pause
    if (e.code === "Space") {
      e.preventDefault();
      togglePlayPause();
      return;
    }

    // Arrow Up / Down: Navigate table rows
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateRows(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateRows(-1);
    }

    // Enter: Edit active row
    if (e.key === "Enter" && state.activeRowIndex >= 0 && state.activeRowIndex < state.tracks.length) {
      e.preventDefault();
      handleEditTrack(state.tracks[state.activeRowIndex].id);
    }
  });

  // Sidebar tempo toggle sync
  if (sidebarAnalyzeTempoCheckbox) {
    sidebarAnalyzeTempoCheckbox.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      if (settingsAnalyzeTempo) settingsAnalyzeTempo.checked = isChecked;
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analyze_tempo: isChecked })
        });
        showToast(isChecked ? t("toast_tempo_enabled") : t("toast_tempo_disabled"), "info");
      } catch (err) {
        console.error("Error updating tempo setting:", err);
      }
    });
  }

  // Folder selection modal triggers
  if (openFolderModalBtn) {
    openFolderModalBtn.addEventListener("click", () => {
      modalFolderInput.value = state.currentMusicDir || "";
      folderModalBackdrop.style.display = "flex";
      modalFolderInput.focus();
    });
  }
  if (closeFolderModalBtn) {
    closeFolderModalBtn.addEventListener("click", () => folderModalBackdrop.style.display = "none");
  }
  if (cancelFolderModalBtn) {
    cancelFolderModalBtn.addEventListener("click", () => folderModalBackdrop.style.display = "none");
  }

  // Presets
  if (presetTestFolderBtn) {
    presetTestFolderBtn.addEventListener("click", () => {
      if (state.currentMusicDir) modalFolderInput.value = state.currentMusicDir;
    });
  }
  if (presetMusicFolderBtn) {
    presetMusicFolderBtn.addEventListener("click", async () => {
      if (state.currentMusicDir) {
        modalFolderInput.value = state.currentMusicDir;
      } else {
        try {
          const res = await fetch("/api/settings");
          const data = await res.json();
          if (data.default_music_dir) modalFolderInput.value = data.default_music_dir;
        } catch (_) {}
      }
    });
  }

  // Windows folder browser picker
  if (modalBrowseWindowsBtn) {
    modalBrowseWindowsBtn.addEventListener("click", async () => {
      modalBrowseWindowsBtn.disabled = true;
      try {
        const res = await fetch("/api/browse-folder", { method: "POST" });
        const data = await res.json();
        if (data.status === "ok" && data.directory) {
          modalFolderInput.value = data.directory;
        }
      } catch (err) {
        showToast(t("toast_folder_picker_error", { err: err.message }), "error");
      } finally {
        modalBrowseWindowsBtn.disabled = false;
      }
    });
  }

  // Modal Scan Now Button
  if (modalScanNowBtn) {
    modalScanNowBtn.addEventListener("click", () => {
      const path = modalFolderInput.value.trim();
      if (!path) {
        showToast(t("toast_scan_select_folder"), "error");
        return;
      }
      const clearPrev = modalClearPreviousCheckbox ? modalClearPreviousCheckbox.checked : true;
      folderModalBackdrop.style.display = "none";
      handleScanWithDir(path, clearPrev);
    });
  }

  // Top Scan button
  if (scanBtn) {
    scanBtn.addEventListener("click", () => handleScanWithDir(state.currentMusicDir, false));
  }
  if (clearLibraryBtn) {
    clearLibraryBtn.addEventListener("click", handleClearLibrary);
  }

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.filters.search = e.target.value;
      if (clearSearchBtn) clearSearchBtn.style.display = e.target.value ? "flex" : "none";
      fetchTracks();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.filters.search = "";
      clearSearchBtn.style.display = "none";
      fetchTracks();
    });
  }

  // Status Filter Rail List
  if (statusRailList) {
    statusRailList.querySelectorAll(".rail-item").forEach(item => {
      item.addEventListener("click", () => {
        statusRailList.querySelectorAll(".rail-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        state.filters.status = item.dataset.status;
        fetchTracks();
      });
    });
  }

  // Dropdown specific filters
  if (genreFilter) {
    genreFilter.addEventListener("change", (e) => {
      state.filters.genre = e.target.value;
      fetchTracks();
    });
  }
  if (subGenreFilter) {
    subGenreFilter.addEventListener("change", (e) => {
      state.filters.sub_genre = e.target.value;
      fetchTracks();
    });
  }

  // Reset filter buttons
  if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetAllFilters);
  if (resetDecadeBtn) {
    resetDecadeBtn.addEventListener("click", () => {
      state.filters.decade = "All";
      renderRailDecades();
      fetchTracks();
    });
  }
  if (resetGenreBtn) {
    resetGenreBtn.addEventListener("click", () => {
      state.filters.parent_genre = "All";
      renderRailParentGenres();
      fetchTracks();
    });
  }

  // Checkbox Select All
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        state.tracks.forEach(t => state.selectedIds.add(t.id));
      } else {
        state.selectedIds.clear();
      }
      syncRowCheckboxes();
      updateSelectionUI();
    });
  }

  // Unselect All Button
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", () => {
      state.selectedIds.clear();
      syncRowCheckboxes();
      updateSelectionUI();
    });
  }

  // Delegated click listener for genre chips in table
  if (tracksTableBody) {
    tracksTableBody.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter-genre]");
      if (chip) {
        e.stopPropagation();
        e.preventDefault();
        const genre = chip.getAttribute("data-filter-genre");
        if (genre) {
          window.handleGenreChipClick(genre);
        }
      }
    });
  }

  // Global Escape key to clear selection if no modal is open
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const anyModalOpen = [progressModal, settingsModal, editModal, folderModalBackdrop].some(m => m && m.style.display && m.style.display !== "none");
      if (!anyModalOpen && state.selectedIds.size > 0) {
        state.selectedIds.clear();
        syncRowCheckboxes();
        updateSelectionUI();
      }
    }
  });

  // Toolbar Actions
  if (analyzeSelectedBtn) analyzeSelectedBtn.addEventListener("click", handleBatchAnalyzeSelected);
  if (batchTagUntaggedBtn) batchTagUntaggedBtn.addEventListener("click", handleBatchTagUntagged);
  if (applySelectedBtn) applySelectedBtn.addEventListener("click", handleBatchApplySelected);

  if (playAllBtn) {
    playAllBtn.addEventListener("click", () => {
      if (state.tracks.length > 0) {
        playTrack(state.tracks[0]);
      }
    });
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", () => {
      if (state.tracks.length > 0) {
        state.isShuffle = true;
        if (playerShuffleToggleBtn) playerShuffleToggleBtn.classList.add("active");
        const randomIndex = Math.floor(Math.random() * state.tracks.length);
        playTrack(state.tracks[randomIndex]);
      }
    });
  }

  // Settings Modal
  if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettings);
  if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener("click", () => settingsModal.style.display = "none");
  if (cancelSettingsBtn) cancelSettingsBtn.addEventListener("click", () => settingsModal.style.display = "none");
  if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettingsData);

  if (settingsLanguage) {
    settingsLanguage.value = window.getCurrentLanguage ? window.getCurrentLanguage() : "en";
    settingsLanguage.addEventListener("change", (e) => {
      const newLang = e.target.value;
      if (window.setLanguage) {
        window.setLanguage(newLang);
      }
    });
  }

  // Handle live language switch reactivity
  window.addEventListener("languageChanged", () => {
    renderRailDecades();
    renderRailParentGenres();
    renderTaxonomyDropdowns();
    renderTracks();
    updateSelectionUI();
    checkSettingsStatus();
    renderModelCascadeUI();
    renderSpotifyPlaylists();
    renderQueueDrawer();
    if (state.appMode === "player") {
      renderPlayerView();
    }
    if (displayCountText) {
      displayCountText.textContent = t("tracks_count", { n: state.tracks.length });
    }
    if (!state.currentPlayingTrack && playerTitle) {
      playerTitle.textContent = t("player_no_track");
    }
  });

  // Model Cascade Preset Buttons
  if (presetUltraFastBtn) {
    presetUltraFastBtn.addEventListener("click", () => {
      state.modelCascade = ["gemini-3.1-flash-lite"];
      renderModelCascadeUI();
      showToast(t("toast_preset_ultrafast"), "info");
    });
  }
  if (presetBalancedBtn) {
    presetBalancedBtn.addEventListener("click", () => {
      state.modelCascade = ["gemini-2.5-flash", "gemini-3.1-flash-lite"];
      renderModelCascadeUI();
      showToast(t("toast_preset_balanced"), "info");
    });
  }
  if (presetMaxQualityBtn) {
    presetMaxQualityBtn.addEventListener("click", () => {
      state.modelCascade = ["gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
      renderModelCascadeUI();
      showToast(t("toast_preset_max"), "info");
    });
  }

  if (toggleApiKeyBtn) {
    toggleApiKeyBtn.addEventListener("click", () => {
      if (settingsApiKey.type === "password") {
        settingsApiKey.type = "text";
      } else {
        settingsApiKey.type = "password";
      }
    });
  }

  // Edit Track Modal
  if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", () => editModal.style.display = "none");
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => editModal.style.display = "none");
  if (saveEditBtn) saveEditBtn.addEventListener("click", () => saveEditTrack(false));
  if (saveAndWriteFileBtn) saveAndWriteFileBtn.addEventListener("click", () => saveEditTrack(true));

  if (closeProgressBtn) closeProgressBtn.addEventListener("click", () => {
    progressModal.style.display = "none";
    if (minimizedBatchProgress) minimizedBatchProgress.style.display = "none";
  });

  if (minimizeProgressBtn) {
    minimizeProgressBtn.addEventListener("click", () => {
      progressModal.style.display = "none";
      if (minimizedBatchProgress) minimizedBatchProgress.style.display = "flex";
    });
  }

  if (minimizedBatchProgress) {
    minimizedBatchProgress.addEventListener("click", () => {
      if (progressModal) progressModal.style.display = "flex";
      minimizedBatchProgress.style.display = "none";
    });
  }

  if (saveAnalyzedAndStopBtn) {
    saveAnalyzedAndStopBtn.addEventListener("click", () => {
      directSaveAnalyzedTracks(currentBatchAnalyzedIds);
    });
  }

  if (cancelProgressBtn) {
    cancelProgressBtn.addEventListener("click", () => {
      isAnalysisCancelled = true;
      if (activeAnalysisAbortController) {
        activeAnalysisAbortController.abort();
      }
      const isSingle = progressCount.textContent.includes("1 track") || progressCount.textContent.includes("audio clip");
      if (isSingle) {
        progressModal.style.display = "none";
        showToast(t("toast_analysis_cancelled"), "info");
      } else {
        if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.cancelled;
        if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
        cancelProgressBtn.style.display = "none";
        closeProgressBtn.style.display = "inline-flex";
        if (minimizeProgressBtn) minimizeProgressBtn.style.display = "none";
        if (currentBatchAnalyzedIds.length > 0 && saveAnalyzedAndStopBtn) {
          saveAnalyzedAndStopBtn.style.display = "inline-flex";
          saveAnalyzedAndStopBtn.disabled = false;
          if (saveAnalyzedBtnText) {
            saveAnalyzedBtnText.textContent = t("progress_save_analyzed_btn", { n: currentBatchAnalyzedIds.length });
          }
        }
        progressModalTitle.textContent = t("progress_cancelled_title");
      }
    });
  }
}

// Keyboard Navigation for Rows
function navigateRows(direction) {
  if (state.tracks.length === 0) return;
  state.activeRowIndex = Math.max(0, Math.min(state.tracks.length - 1, state.activeRowIndex + direction));
  const track = state.tracks[state.activeRowIndex];
  if (!track) return;

  // Highlight row visually
  document.querySelectorAll(".tracks-table tbody tr").forEach((tr, idx) => {
    tr.classList.toggle("row-active", idx === state.activeRowIndex);
    if (idx === state.activeRowIndex) {
      tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function updateProgressSliderFill(pct = 0) {
  if (!playerProgressBar) return;
  const p = Math.min(100, Math.max(0, pct));
  playerProgressBar.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${p}%, var(--border) ${p}%, var(--border) 100%)`;
}

function updateVolumeSliderFill(vol = 0.8) {
  if (!playerVolumeBar) return;
  const p = Math.min(100, Math.max(0, vol * 100));
  playerVolumeBar.style.background = `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${p}%, var(--border) ${p}%, var(--border) 100%)`;
}

// --- Audio Player Logic ---
function initAudio() {
  state.audio = nativeAudio;

  if (playerPlayPauseBtn) playerPlayPauseBtn.addEventListener("click", togglePlayPause);
  if (playerPrevBtn) playerPrevBtn.addEventListener("click", playPrevTrack);
  if (playerNextBtn) playerNextBtn.addEventListener("click", playNextTrack);
  if (playerQueueToggleBtn) playerQueueToggleBtn.addEventListener("click", () => toggleQueueDrawer());

  if (playerShuffleToggleBtn) {
    playerShuffleToggleBtn.addEventListener("click", () => {
      state.isShuffle = !state.isShuffle;
      playerShuffleToggleBtn.classList.toggle("active", state.isShuffle);
    });
  }

  if (playerLoopBtn) {
    playerLoopBtn.addEventListener("click", () => {
      if (state.loopMode === "all") {
        state.loopMode = "one";
        playerLoopBtn.classList.add("active");
        playerLoopBtn.title = t("player_repeat_one");
      } else if (state.loopMode === "one") {
        state.loopMode = "off";
        playerLoopBtn.classList.remove("active");
        playerLoopBtn.title = t("player_repeat_off");
      } else {
        state.loopMode = "all";
        playerLoopBtn.classList.add("active");
        playerLoopBtn.title = t("player_repeat_all");
      }
    });
  }

  if (playerMuteBtn) {
    playerMuteBtn.addEventListener("click", () => {
      if (state.isMuted) {
        state.audio.volume = state.previousVolume;
        playerVolumeBar.value = state.previousVolume;
        updateVolumeSliderFill(state.previousVolume);
        state.isMuted = false;
        volIconSvg.outerHTML = ICONS.volume2;
      } else {
        state.previousVolume = state.audio.volume;
        state.audio.volume = 0;
        playerVolumeBar.value = 0;
        updateVolumeSliderFill(0);
        state.isMuted = true;
        volIconSvg.outerHTML = ICONS.volumeX;
      }
    });
  }

  if (playerVolumeBar) {
    updateVolumeSliderFill(playerVolumeBar.value ? parseFloat(playerVolumeBar.value) : 0.8);
    playerVolumeBar.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.audio.volume = val;
      updateVolumeSliderFill(val);
      state.isMuted = val === 0;
      if (state.isMuted) {
        volIconSvg.outerHTML = ICONS.volumeX;
      } else {
        volIconSvg.outerHTML = ICONS.volume2;
      }
    });
  }

  if (playerProgressBar) {
    updateProgressSliderFill(0);
    playerProgressBar.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      updateProgressSliderFill(val);
      if (state.audio && !isNaN(state.audio.duration)) {
        state.audio.currentTime = (val / 100) * state.audio.duration;
      }
    });
  }

  if (state.audio) {
    state.audio.addEventListener("timeupdate", () => {
      if (!isNaN(state.audio.duration) && state.audio.duration > 0) {
        const pct = (state.audio.currentTime / state.audio.duration) * 100;
        playerProgressBar.value = pct;
        updateProgressSliderFill(pct);
        playerCurrentTime.textContent = formatTime(state.audio.currentTime);
        playerTotalTime.textContent = formatTime(state.audio.duration);
      }
    });

    state.audio.addEventListener("ended", () => {
      updateProgressSliderFill(0);
      if (state.loopMode === "one") {
        state.audio.currentTime = 0;
        state.audio.play();
      } else {
        playNextTrack();
      }
    });

    state.audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtonUI();
      if (state.appMode === "player") updatePlayerPlayingStateUI();
    });

    state.audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtonUI();
      if (state.appMode === "player") updatePlayerPlayingStateUI();
    });
  }
}

function playTrack(track) {
  if (!track) return;
  // Add current track to history before switching to new track
  if (state.currentPlayingTrack && state.currentPlayingTrack.id !== track.id) {
    state.playHistory.push(state.currentPlayingTrack);
    // Keep history limited to last 100 tracks to avoid memory issues
    if (state.playHistory.length > 100) {
      state.playHistory.shift();
    }
  }
  state.currentPlayingTrack = track;
  state.audio.src = `/api/stream/${track.id}`;
  state.audio.play().catch(e => console.warn("Playback error:", e));
  state.isPlaying = true;
  updateProgressSliderFill(0);

  if (playerTitle) {
    playerTitle.removeAttribute("data-i18n");
    playerTitle.textContent = track.title || track.file_name;
    playerTitle.title = track.title || track.file_name;
  }
  if (playerArtist) {
    playerArtist.textContent = track.artist || "—";
    playerArtist.title = track.artist || "—";
  }

  if (playerCover) {
    if (track.has_cover) {
      playerCover.innerHTML = `<img src="${getTrackCoverUrl(track.id, track.cover_v)}" alt="">`;
    } else {
      playerCover.innerHTML = ICONS.disc;
    }
  }

  updatePlayButtonUI();
  updatePlayerLikeBtnUI(track);
  if (state.appMode !== "player") {
    renderTracks();
  } else {
    updatePlayerPlayingStateUI();
  }
  renderQueueUI();
}
window.playTrack = playTrack;

function updatePlayerLikeBtnUI(track) {
  if (!playerLikeBtn) return;
  const isLiked = track && !!track.is_liked;
  playerLikeBtn.classList.toggle("liked", isLiked);
  playerLikeBtn.title = isLiked ? t("unlike_song") : t("like_song");
  if (playerLikeIcon) {
    playerLikeIcon.setAttribute("fill", isLiked ? "#ef4444" : "none");
    playerLikeIcon.setAttribute("stroke", isLiked ? "#ef4444" : "currentColor");
  }
}

function togglePlayPause() {
  if (!state.currentPlayingTrack && state.tracks.length > 0) {
    playTrack(state.tracks[0]);
    return;
  }
  if (!state.audio) return;
  if (state.isPlaying) {
    state.audio.pause();
  } else {
    state.audio.play().catch(e => console.warn("Play error:", e));
  }
}

function updatePlayButtonUI() {
  if (playerPlayPauseBtn) {
    playerPlayPauseBtn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
    playerPlayPauseBtn.title = state.isPlaying ? t("player_pause_space") : t("player_play_space");
  }
}

function playPrevTrack() {
  if (!state.currentPlayingTrack || state.tracks.length === 0) return;
  
  // If shuffle is on and we have play history, go back to the previous track that was played
  if (state.isShuffle && state.playHistory.length > 0) {
    const prevTrack = state.playHistory.pop();
    playTrack(prevTrack);
    return;
  }
  
  // Normal sequential previous (when shuffle is off)
  const idx = state.tracks.findIndex(t => t.id === state.currentPlayingTrack.id);
  if (idx > 0) {
    playTrack(state.tracks[idx - 1]);
  } else {
    playTrack(state.tracks[state.tracks.length - 1]);
  }
}

function playNextTrack() {
  if (state.queue && state.queue.length > 0) {
    const nextQueuedTrack = state.queue.shift();
    playTrack(nextQueuedTrack);
    renderQueueUI();
    return;
  }
  if (!state.currentPlayingTrack || state.tracks.length === 0) return;
  if (state.isShuffle) {
    const r = Math.floor(Math.random() * state.tracks.length);
    playTrack(state.tracks[r]);
    return;
  }
  const idx = state.tracks.findIndex(t => t.id === state.currentPlayingTrack.id);
  if (idx >= 0 && idx < state.tracks.length - 1) {
    playTrack(state.tracks[idx + 1]);
  } else if (state.loopMode === "all") {
    playTrack(state.tracks[0]);
  } else {
    state.isPlaying = false;
    updatePlayButtonUI();
    renderTracks();
    if (state.appMode === "player") updatePlayerPlayingStateUI();
  }
}

function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- Data Fetching & Table Rendering ---
async function loadInitialData() {
  await checkSettingsStatus();
  await fetchTaxonomies();
  await fetchStats();
  await fetchTracks();

  if (state.tracks.length === 0) {
    handleScan();
  }

  await loadPlaylists();
  if (state.appMode === "player") {
    switchAppMode("player");
  }
}

async function checkSettingsStatus() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (data.default_music_dir) {
      state.currentMusicDir = data.default_music_dir;
      if (headerFolderDisplay) headerFolderDisplay.textContent = data.default_music_dir;
      if (modalFolderInput) modalFolderInput.value = data.default_music_dir;
    }

    if (data.language && !localStorage.getItem("soundscope_language") && !localStorage.getItem("sonictag_language")) {
      if (window.setLanguage) window.setLanguage(data.language);
    }

    if (data.has_api_key) {
      apiKeyStatus.textContent = `${t("settings_api_connected")} (${data.gemini_api_key_masked})`;
      apiKeyStatus.style.color = "var(--ok)";
      if (navApiDot) {
        navApiDot.className = "api-dot connected";
      }
      if (navApiLabel) {
        navApiLabel.textContent = t("api_ready");
      }
    } else {
      apiKeyStatus.textContent = t("settings_api_unconfigured");
      apiKeyStatus.style.color = "var(--warn)";
      if (navApiDot) {
        navApiDot.className = "api-dot disconnected";
      }
      if (navApiLabel) {
        navApiLabel.textContent = t("api_not_set");
      }
    }

    if (data.analyze_tempo !== undefined) {
      if (sidebarAnalyzeTempoCheckbox) sidebarAnalyzeTempoCheckbox.checked = data.analyze_tempo;
      if (settingsAnalyzeTempo) settingsAnalyzeTempo.checked = data.analyze_tempo;
    }
  } catch (err) {
    console.error("Settings status check error:", err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();
    statTotal.textContent = data.total;
    statUnprocessed.textContent = data.unprocessed;
    statAnalyzed.textContent = data.analyzed;
    statSaved.textContent = data.saved;

    // Update rail counts
    if (countStatusAll) countStatusAll.textContent = data.total;
    if (countStatusUntagged) countStatusUntagged.textContent = data.unprocessed;
    if (countStatusAnalyzed) countStatusAnalyzed.textContent = data.analyzed;
    if (countStatusSaved) countStatusSaved.textContent = data.saved;

    if (batchTagUntaggedLabel) {
      batchTagUntaggedLabel.textContent = t("auto_tag_n", { n: data.unprocessed });
    }
  } catch (err) {
    console.error("Error fetching stats:", err);
  }
}

async function fetchTaxonomies() {
  try {
    const res = await fetch("/api/taxonomies");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.taxonomies = data;
    if (spLikedCountBadge) {
      spLikedCountBadge.textContent = data.liked_count ?? 0;
    }

    renderRailDecades();
    renderRailParentGenres();
    renderTaxonomyDropdowns();
  } catch (err) {
    console.error("Error fetching taxonomies:", err);
  }
}

function renderRailDecades() {
  if (!decadeRailList) return;
  const decades = (state.taxonomies.decades && state.taxonomies.decades.length > 0)
    ? state.taxonomies.decades
    : ["2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "1960s"];

  let decadeCounts = state.taxonomies.decade_counts;
  if (!decadeCounts || Object.keys(decadeCounts).length === 0) {
    decadeCounts = {};
    state.tracks.forEach(t => {
      if (t.decade) {
        decadeCounts[t.decade] = (decadeCounts[t.decade] || 0) + 1;
      }
    });
  }

  const totalCount = state.taxonomies.total_tracks ?? state.tracks.length;

  let html = `
    <button class="rail-item ${state.filters.decade === 'All' ? 'active' : ''}" data-decade="All">
      <span class="rail-item-label">${t("all_decades")}</span>
      <span class="rail-count">${totalCount}</span>
    </button>
  `;

  decades.forEach(d => {
    const c = decadeCounts[d] || 0;
    html += `
      <button class="rail-item ${state.filters.decade === d ? 'active' : ''}" data-decade="${d}">
        <span class="rail-item-label">${d}</span>
        <span class="rail-count">${c}</span>
      </button>
    `;
  });

  decadeRailList.innerHTML = html;
  decadeRailList.querySelectorAll(".rail-item").forEach(btn => {
    btn.addEventListener("click", () => {
      decadeRailList.querySelectorAll(".rail-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.filters.decade = btn.dataset.decade;
      fetchTracks();
    });
  });
}

function renderRailParentGenres() {
  if (!parentGenreRailList) return;
  const parents = (state.taxonomies.parent_genres && state.taxonomies.parent_genres.length > 0)
    ? state.taxonomies.parent_genres
    : ["Blues", "Country", "EDM", "Electronic", "Folk", "Hip Hop", "Latin", "Metal", "Pop", "R&B", "Reggae", "Rock"];

  let parentCounts = state.taxonomies.parent_genre_counts;
  if (!parentCounts || Object.keys(parentCounts).length === 0) {
    parentCounts = {};
    state.tracks.forEach(t => {
      if (t.parent_genre) {
        parentCounts[t.parent_genre] = (parentCounts[t.parent_genre] || 0) + 1;
      }
    });
  }

  const totalCount = state.taxonomies.total_tracks ?? state.tracks.length;
  const untaggedParentCount = state.taxonomies.missing_parent_count ?? state.tracks.filter(t => !t.parent_genre).length;

  let html = `
    <button class="rail-item ${state.filters.parent_genre === 'All' ? 'active' : ''}" data-parent="All">
      <span class="rail-item-label">${t("all_genres")}</span>
      <span class="rail-count">${totalCount}</span>
    </button>
  `;

  parents.forEach(p => {
    const c = parentCounts[p] || 0;
    html += `
      <button class="rail-item ${state.filters.parent_genre === p ? 'active' : ''}" data-parent="${escapeHtml(p)}">
        <span class="rail-item-label">${escapeHtml(p)}</span>
        <span class="rail-count">${c}</span>
      </button>
    `;
  });

  if (untaggedParentCount > 0) {
    html += `
      <button class="rail-item ${state.filters.parent_genre === '__missing__' ? 'active' : ''}" data-parent="__missing__" style="color: var(--warn, #f59e0b);">
        <span class="rail-item-label">⚠️ ${t("missing_parent_tag")}</span>
        <span class="rail-count" style="color: var(--warn, #f59e0b);">${untaggedParentCount}</span>
      </button>
    `;
  }

  parentGenreRailList.innerHTML = html;
  parentGenreRailList.querySelectorAll(".rail-item").forEach(btn => {
    btn.addEventListener("click", () => {
      parentGenreRailList.querySelectorAll(".rail-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.filters.parent_genre = btn.dataset.parent;
      fetchTracks();
    });
  });
}

function renderTaxonomyDropdowns() {
  if (genreFilter) {
    const curr = genreFilter.value;
    genreFilter.innerHTML = `<option value="All">${t("select_all_core")}</option>` +
      (state.taxonomies.genres || []).map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    genreFilter.value = curr || "All";
  }

  if (subGenreFilter) {
    const curr = subGenreFilter.value;
    subGenreFilter.innerHTML = `<option value="All">${t("select_all_sub")}</option>` +
      (state.taxonomies.sub_genres || []).map(sg => `<option value="${escapeHtml(sg)}">${escapeHtml(sg)}</option>`).join("");
    subGenreFilter.value = curr || "All";
  }
}

async function fetchTracks() {
  const params = new URLSearchParams();
  if (state.filters.search) params.append("search", state.filters.search);
  if (state.filters.decade && state.filters.decade !== "All") params.append("decade", state.filters.decade);
  if (state.filters.parent_genre && state.filters.parent_genre !== "All") params.append("parent_genre", state.filters.parent_genre);
  if (state.filters.genre && state.filters.genre !== "All") params.append("genre", state.filters.genre);
  if (state.filters.sub_genre && state.filters.sub_genre !== "All") params.append("sub_genre", state.filters.sub_genre);
  if (state.filters.tempo && state.filters.tempo !== "All") params.append("tempo", state.filters.tempo);
  if (state.filters.is_liked && state.filters.is_liked !== "All") params.append("is_liked", state.filters.is_liked);
  if (state.filters.status && state.filters.status !== "All") params.append("status", state.filters.status);
  params.append("sort_by", state.sortBy);
  params.append("sort_order", state.sortOrder);

  try {
    const res = await fetch(`/api/tracks?${params.toString()}`);
    const data = await res.json();
    state.tracks = data;

    // Cache complete library when no narrowing filters are active or master list is uninitialized
    const noFiltersActive = !state.filters.search &&
      state.filters.decade === "All" &&
      state.filters.parent_genre === "All" &&
      state.filters.genre === "All" &&
      state.filters.sub_genre === "All" &&
      state.filters.tempo === "All" &&
      state.filters.is_liked === "All" &&
      state.filters.status === "All";
    if (noFiltersActive || !state.allTracks || state.allTracks.length === 0) {
      state.allTracks = [...data];
    }

    renderTracks();
    renderRailDecades();
    renderRailParentGenres();
    updateSelectionUI();
    if (displayCountText) displayCountText.textContent = t("tracks_count", { n: data.length });
    if (state.appMode === "player") {
      if (state.playerView === "all-tracks") {
        const statsEl = document.getElementById("spDetailStats");
        const tableContainer = document.getElementById("spAllTracksTableContainer");
        if (statsEl && tableContainer) {
          statsEl.innerHTML = `<span>${t("pm_tracks_count", { n: state.tracks.length })}</span><span>•</span><span>${formatTotalDuration(state.tracks)}</span>`;
          tableContainer.innerHTML = buildTracklistTableHtml(state.tracks, false);
          updatePlayerFilterDropdowns();
        } else {
          renderPlayerView(false);
        }
      } else {
        renderPlayerView(false);
      }
    }
  } catch (err) {
    console.error("Error fetching tracks:", err);
  }
}

function renderTracks() {
  if (state.tracks.length === 0) {
    tracksTableBody.innerHTML = "";
    tableStateOverlay.style.display = "flex";
    return;
  }
  tableStateOverlay.style.display = "none";

  let html = "";
  state.tracks.forEach((track, idx) => {
    const isSelected = state.selectedIds.has(track.id);
    const isPlaying = state.currentPlayingTrack && state.currentPlayingTrack.id === track.id && state.isPlaying;

    // Status Indicator
    let statusClass = "untagged";
    let statusLabel = t("status_untagged_label");
    if (track.status === "saved") {
      statusClass = "saved";
      statusLabel = t("status_saved_label");
    } else if (track.status === "analyzed") {
      statusClass = "suggested";
      statusLabel = t("status_suggested_label");
    }

    const activeSearch = (state.filters.search || "").trim().toLowerCase();

    // Genre hierarchy chips with interactive click-to-search
    const isParentActive = activeSearch && track.parent_genre && activeSearch === track.parent_genre.toLowerCase();
    const isGenreActive = activeSearch && track.genre && activeSearch === track.genre.toLowerCase();
    const isSubActive = activeSearch && track.sub_genre && activeSearch === track.sub_genre.toLowerCase();

    const parentChip = track.parent_genre
      ? `<span class="chip-parent chip-clickable ${isParentActive ? 'chip-active' : ''}" data-filter-genre="${escapeHtml(track.parent_genre)}" title="${t('chip_search_tip', { genre: track.parent_genre })}">${escapeHtml(track.parent_genre)}</span>`
      : `<span style="color:var(--text-3); font-size:11px;">—</span>`;

    const genreChip = track.genre
      ? `<span class="chip-genre chip-clickable ${isGenreActive ? 'chip-active' : ''}" data-filter-genre="${escapeHtml(track.genre)}" title="${t('chip_search_tip', { genre: track.genre })}">${escapeHtml(track.genre)}</span>`
      : `<span style="color:var(--text-3); font-size:11px;">—</span>`;

    const subgenreChip = track.sub_genre
      ? `<span class="chip-subgenre chip-clickable ${isSubActive ? 'chip-active' : ''}" data-filter-genre="${escapeHtml(track.sub_genre)}" title="${t('chip_search_tip', { genre: track.sub_genre })}">${escapeHtml(track.sub_genre)}</span>`
      : `<span style="color:var(--text-3); font-size:11px;">—</span>`;

    // Artwork
    const artContent = track.has_cover
      ? `<img src="${getTrackCoverUrl(track.id, track.cover_v)}" loading="lazy" decoding="async" alt="">`
      : ICONS.disc;

    const playOverlay = isPlaying ? ICONS.pause : ICONS.play;

    html += `
      <tr data-id="${track.id}" class="${isSelected ? 'row-selected' : ''} ${isPlaying ? 'row-playing' : ''} ${idx === state.activeRowIndex ? 'row-active' : ''}" ondblclick="handleRowPlay(${track.id})">
        <td class="col-check">
          <label class="checkbox-custom">
            <input type="checkbox" class="track-row-checkbox" data-id="${track.id}" ${isSelected ? 'checked' : ''}>
            <span class="checkbox-box">${ICONS.check}</span>
          </label>
        </td>
        <td class="col-art">
          <div class="art-thumbnail" onclick="handleRowPlay(${track.id})" title="${t('action_play_tip')}">
            ${artContent}
            <div class="art-play-overlay">${playOverlay}</div>
          </div>
        </td>
        <td>
          <div class="track-info-cell">
            <span class="track-title" title="${escapeHtml(track.title || track.file_name)}">${escapeHtml(track.title || track.file_name)}</span>
            <span class="track-artist" title="${escapeHtml(track.artist || '—')}">${escapeHtml(track.artist || '—')}</span>
          </div>
        </td>
        <td>
          <span class="track-year">${track.release_year || '—'}</span>
          ${track.decade ? `<span class="track-decade">(${escapeHtml(track.decade)})</span>` : ''}
        </td>
        <td>
          <div class="genre-chips-wrap">${parentChip}</div>
        </td>
        <td>
          <div class="genre-chips-wrap">${genreChip}</div>
        </td>
        <td>
          <div class="genre-chips-wrap">${subgenreChip}</div>
        </td>
        <td>
          <span class="track-bpm">${escapeHtml(track.tempo || '—')}</span>
        </td>
        <td>
          <div class="status-cell">
            <span class="status-dot ${statusClass}"></span>
            <span>${statusLabel}</span>
          </div>
        </td>
        <td class="text-right">
          <div class="row-actions">
            <button class="btn-icon btn-ai-sparkle" onclick="handleAnalyzeSingle(${track.id})" title="${t('action_analyze_ai')}">
              ${ICONS.sparkles}
            </button>
            <button class="btn-icon" onclick="handleAnalyzeSound(${track.id})" title="${t('action_analyze_sound')}">
              ${ICONS.headphones}
            </button>
            <button class="btn-icon" onclick="handleEditTrack(${track.id})" title="${t('action_edit')}">
              ${ICONS.pencil}
            </button>
            <button class="btn-icon btn-save-track" data-id="${track.id}" onclick="handleApplySingle(${track.id})" title="${t('action_save')}">
              ${ICONS.save}
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tracksTableBody.innerHTML = html;

  // Wire checkbox events with Shift+Click range selection
  const allCheckboxes = Array.from(tracksTableBody.querySelectorAll(".track-row-checkbox"));

  allCheckboxes.forEach((cb, idx) => {
    cb.addEventListener("click", (e) => {
      const id = parseInt(cb.dataset.id);

      if (e.shiftKey && state.lastCheckedIndex !== null && state.lastCheckedIndex !== idx) {
        // Shift+Click: select range between lastCheckedIndex and current
        const start = Math.min(state.lastCheckedIndex, idx);
        const end = Math.max(state.lastCheckedIndex, idx);
        const shouldCheck = cb.checked; // use the new state of the clicked checkbox

        for (let i = start; i <= end; i++) {
          const rangeId = parseInt(allCheckboxes[i].dataset.id);
          if (shouldCheck) {
            state.selectedIds.add(rangeId);
          } else {
            state.selectedIds.delete(rangeId);
          }
          allCheckboxes[i].checked = shouldCheck;
        }
      } else {
        // Normal click: toggle single
        if (cb.checked) {
          state.selectedIds.add(id);
        } else {
          state.selectedIds.delete(id);
        }
      }

      state.lastCheckedIndex = idx;
      updateSelectionUI();
    });
  });
}

function syncRowCheckboxes() {
  document.querySelectorAll(".track-row-checkbox").forEach(cb => {
    const id = parseInt(cb.dataset.id);
    cb.checked = state.selectedIds.has(id);
  });
}

function updateSelectionUI() {
  const count = state.selectedIds.size;
  selectedCountText.textContent = t("selected_count", { n: count });
  selectAllCheckbox.checked = count > 0 && count === state.tracks.length;
  selectAllCheckbox.indeterminate = count > 0 && count < state.tracks.length;

  if (clearSelectionBtn) {
    clearSelectionBtn.style.display = count > 0 ? "inline-flex" : "none";
  }

  analyzeSelectedBtn.disabled = count === 0;
  applySelectedBtn.disabled = count === 0;

  if (count > 0) {
    analyzeSelectedBtn.querySelector("span").textContent = t("analyze_selected_n", { n: count });
    applySelectedBtn.querySelector("span").textContent = t("save_to_file_n", { n: count });
  } else {
    analyzeSelectedBtn.querySelector("span").textContent = t("analyze_selected");
    applySelectedBtn.querySelector("span").textContent = t("save_to_file");
  }
}

// --- Interactive Genre Chip Search ---
window.handleGenreChipClick = function(genreText) {
  if (!genreText || genreText === "—") return;
  const term = genreText.trim();

  // Toggle off if clicking the already active search
  if (state.filters.search && state.filters.search.toLowerCase() === term.toLowerCase()) {
    state.filters.search = "";
    if (searchInput) searchInput.value = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    fetchTracks();
    showToast(t("toast_filter_cleared") || "Filter pencarian dibersihkan", "info");
    return;
  }

  // Populate and activate search bar
  state.filters.search = term;
  if (searchInput) {
    searchInput.value = term;
  }
  if (clearSearchBtn) {
    clearSearchBtn.style.display = "flex";
  }

  // Clear specific rail and dropdown filters so there are no conflicting constraints
  state.filters.parent_genre = "All";
  state.filters.genre = "All";
  state.filters.sub_genre = "All";
  if (genreFilter) genreFilter.value = "All";
  if (subGenreFilter) subGenreFilter.value = "All";

  fetchTracks();

  const msg = t("toast_search_genre", { genre: term }) || `🔍 Menampilkan lagu: "${term}"`;
  showToast(msg, "info");
};

// Table Sorting
window.handleSort = function(field) {
  if (state.sortBy === field) {
    state.sortOrder = state.sortOrder === "ASC" ? "DESC" : "ASC";
  } else {
    state.sortBy = field;
    state.sortOrder = "ASC";
  }

  // Update sort arrows
  ["Title", "Year", "Parent", "Genre", "SubGenre", "Tempo", "Status"].forEach(f => {
    const el = document.getElementById(`sortArrow${f}`);
    if (el) el.textContent = "";
  });

  const arrow = state.sortOrder === "ASC" ? "▲" : "▼";
  const map = {
    title: "Title",
    release_year: "Year",
    parent_genre: "Parent",
    genre: "Genre",
    sub_genre: "SubGenre",
    tempo: "Tempo",
    status: "Status"
  };
  if (map[field]) {
    const el = document.getElementById(`sortArrow${map[field]}`);
    if (el) el.textContent = arrow;
  }

  fetchTracks();
};

// --- Actions & Operations ---
window.handleRowPlay = function(id) {
  const track = state.tracks.find(t => t.id === id);
  if (!track) return;
  if (state.currentPlayingTrack && state.currentPlayingTrack.id === id) {
    togglePlayPause();
  } else {
    playTrack(track);
  }
};

async function handleScanWithDir(dir, clearPrev = false) {
  if (!dir) {
    showToast(t("toast_scan_select_folder"), "error");
    if (folderModalBackdrop) folderModalBackdrop.style.display = "flex";
    return;
  }

  scanBtn.disabled = true;
  scanBtn.innerHTML = `${ICONS.disc} <span>${t("scanning")}</span>`;
  renderSkeletonRows();

  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: dir, clear_previous: clearPrev })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Scan failed");
    }
    const data = await res.json();
    state.currentMusicDir = dir;
    if (headerFolderDisplay) headerFolderDisplay.textContent = dir;
    if (modalFolderInput) modalFolderInput.value = dir;

    showToast(t("toast_scan_success", { n: data.scanned_count }), "success");
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    showToast(t("toast_scan_failed", { err: err.message }), "error");
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerHTML = `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> <span data-i18n="scan">${t("scan")}</span>`;
  }
}

async function handleScan() {
  handleScanWithDir(state.currentMusicDir, false);
}

function renderSkeletonRows() {
  let html = "";
  for (let i = 0; i < 8; i++) {
    html += `
      <tr class="skeleton-row">
        <td style="width:36px;"><div class="skeleton-box" style="width:16px; height:16px;"></div></td>
        <td style="width:44px;"><div class="skeleton-box" style="width:32px; height:32px;"></div></td>
        <td><div class="skeleton-box" style="width:60%; height:14px; margin-bottom:4px;"></div><div class="skeleton-box" style="width:40%; height:11px;"></div></td>
        <td><div class="skeleton-box" style="width:50px; height:14px;"></div></td>
        <td><div class="skeleton-box" style="width:70px; height:18px;"></div></td>
        <td><div class="skeleton-box" style="width:80px; height:18px;"></div></td>
        <td><div class="skeleton-box" style="width:80px; height:18px;"></div></td>
        <td><div class="skeleton-box" style="width:60px; height:14px;"></div></td>
        <td><div class="skeleton-box" style="width:70px; height:14px;"></div></td>
        <td><div class="skeleton-box" style="width:80px; height:24px;"></div></td>
      </tr>
    `;
  }
  tracksTableBody.innerHTML = html;
}

async function handleClearLibrary() {
  if (state.tracks.length === 0) {
    showToast(t("toast_clear_empty"), "info");
    return;
  }

  const confirmed = confirm(t("toast_clear_confirm"));
  if (!confirmed) return;

  clearLibraryBtn.disabled = true;
  try {
    const res = await fetch("/api/clear", { method: "POST" });
    if (!res.ok) throw new Error(t("toast_clear_library_failed", { err: res.statusText }));

    state.tracks = [];
    state.allTracks = [];
    state.selectedIds.clear();

    if (state.audio && !state.audio.paused) {
      state.audio.pause();
      state.isPlaying = false;
      updatePlayButtonUI();
    }
    state.currentPlayingTrack = null;
    playerTitle.textContent = t("player_no_track");
    playerArtist.textContent = "—";
    playerCover.innerHTML = ICONS.disc;

    await fetchTaxonomies();
    await fetchStats();
    renderTracks();
    updateSelectionUI();
    showToast(t("toast_clear_success"), "success");
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  } finally {
    clearLibraryBtn.disabled = false;
  }
}

window.handleAnalyzeSingle = async function(id) {
  const track = state.tracks.find(t => t.id === id);
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const sparkleBtn = row ? row.querySelector(".btn-ai-sparkle") : null;
  if (sparkleBtn) {
    sparkleBtn.disabled = true;
    sparkleBtn.innerHTML = `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
  }

  activeAnalysisAbortController = new AbortController();
  isAnalysisCancelled = false;

  if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
  if (batchProgressFill) batchProgressFill.style.background = "var(--accent)";
  progressModalTitle.textContent = t("progress_title_analyzing");
  progressModalDesc.textContent = track ? `${track.artist || '—'} - ${track.title || track.file_name}` : t("progress_desc_analyzing");
  batchProgressFill.style.width = "40%";
  progressCount.textContent = t("progress_count_1_track");
  if (cancelProgressBtn) cancelProgressBtn.style.display = "inline-flex";
  if (closeProgressBtn) closeProgressBtn.style.display = "none";
  progressModal.style.display = "flex";

  try {
    const res = await fetch(`/api/analyze/${id}`, {
      method: "POST",
      signal: activeAnalysisAbortController.signal
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Analysis failed");
    }
    const data = await res.json();
    progressModal.style.display = "none";
    playAnalysisCompleteSound();
    showToast(t("toast_analyze_success", { parent: data.ai_data.parent_genre, genre: data.ai_data.genre }), "success");
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    progressModal.style.display = "none";
    if (err.name === "AbortError" || isAnalysisCancelled) {
      showToast(t("toast_analysis_cancelled"), "info");
    } else {
      showToast(t("toast_analyze_failed", { err: err.message }), "error");
    }
  } finally {
    activeAnalysisAbortController = null;
    if (sparkleBtn) {
      sparkleBtn.disabled = false;
      sparkleBtn.innerHTML = ICONS.sparkles;
    }
  }
};

window.handleAnalyzeSound = async function(id) {
  const track = state.tracks.find(t => t.id === id);
  activeAnalysisAbortController = new AbortController();
  isAnalysisCancelled = false;

  if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
  if (batchProgressFill) batchProgressFill.style.background = "var(--accent)";
  progressModalTitle.textContent = t("toast_analyze_sound_start");
  progressModalDesc.textContent = track ? `${track.artist || '—'} - ${track.title || track.file_name}` : t("progress_sampling_sound");
  batchProgressFill.style.width = "50%";
  progressCount.textContent = t("progress_count_1_clip");
  if (cancelProgressBtn) cancelProgressBtn.style.display = "inline-flex";
  if (closeProgressBtn) closeProgressBtn.style.display = "none";
  progressModal.style.display = "flex";

  try {
    const res = await fetch(`/api/analyze-audio/${id}`, {
      method: "POST",
      signal: activeAnalysisAbortController.signal
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Audio analysis failed");
    }
    const data = await res.json();
    progressModal.style.display = "none";
    playAnalysisCompleteSound();
    showToast(t("toast_analyze_sound_success"), "success");
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    progressModal.style.display = "none";
    if (err.name === "AbortError" || isAnalysisCancelled) {
      showToast(t("toast_analysis_cancelled"), "info");
    } else {
      showToast(t("toast_analyze_sound_failed", { err: err.message }), "error");
    }
  } finally {
    activeAnalysisAbortController = null;
  }
};

window.handleApplySingle = async function(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const saveBtn = row ? row.querySelector(".btn-save-track") : null;
  const statusCell = row ? row.querySelector(".status-cell") : null;
  const originalBtnHtml = saveBtn ? saveBtn.innerHTML : null;
  const originalStatusHtml = statusCell ? statusCell.innerHTML : null;

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
  }
  if (statusCell) {
    statusCell.innerHTML = `<span class="status-dot saving"></span><span>${t("status_saving_label")}</span>`;
  }

  try {
    const res = await fetch(`/api/apply-tags/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Save failed");
    }
    const data = await res.json();
    
    // Update local track state
    const track = state.tracks.find(t => t.id === id);
    if (track) {
      track.status = "saved";
      if (data.track && data.track.parent_genre) track.parent_genre = data.track.parent_genre;
    }

    if (statusCell) {
      statusCell.innerHTML = `<span class="status-dot saved"></span><span>${t("status_saved_label")}</span>`;
    }
    if (saveBtn) {
      saveBtn.innerHTML = `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = ICONS.save;
        }
      }, 2000);
    }

    showToast(t("toast_save_success"), "success");
    await fetchStats();
  } catch (err) {
    if (statusCell && originalStatusHtml) statusCell.innerHTML = originalStatusHtml;
    if (saveBtn) {
      saveBtn.disabled = false;
      if (originalBtnHtml) saveBtn.innerHTML = originalBtnHtml;
    }
    showToast(t("toast_save_failed", { err: err.message }), "error");
  }
};

let currentBatchAnalyzedIds = [];

async function directSaveAnalyzedTracks(trackIds) {
  let idsToSave = (trackIds && trackIds.length > 0) ? [...trackIds] : [];
  if (idsToSave.length === 0) {
    idsToSave = state.tracks.filter(t => t.status === "analyzed").map(t => t.id);
  }
  if (idsToSave.length === 0) {
    showToast(t("toast_no_analyzed_to_save"), "info");
    return;
  }

  isAnalysisCancelled = true;
  if (activeAnalysisAbortController) {
    activeAnalysisAbortController.abort();
  }

  if (saveAnalyzedAndStopBtn) {
    saveAnalyzedAndStopBtn.disabled = true;
    saveAnalyzedAndStopBtn.innerHTML = `
      <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>${t("status_saving_label")}</span>
    `;
  }

  progressModalTitle.textContent = t("progress_batch_saving_title");
  progressModalDesc.textContent = t("progress_batch_saving_desc");
  if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
  if (batchProgressFill) {
    batchProgressFill.style.width = "75%";
    batchProgressFill.style.background = "var(--accent)";
  }

  try {
    const res = await fetch("/api/batch-apply-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: idsToSave })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Batch save failed");
    }
    const data = await res.json();

    if (batchProgressFill) {
      batchProgressFill.style.width = "100%";
      batchProgressFill.style.background = "var(--ok)";
    }
    if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.completed;
    progressModalTitle.textContent = t("progress_batch_saved_title");
    progressModalDesc.textContent = `${t("toast_batch_saved_success", { n: data.saved_count })}`;
    if (cancelProgressBtn) cancelProgressBtn.style.display = "none";
    if (saveAnalyzedAndStopBtn) saveAnalyzedAndStopBtn.style.display = "none";
    if (closeProgressBtn) closeProgressBtn.style.display = "inline-flex";

    state.tracks.forEach(t => {
      if (idsToSave.includes(t.id)) t.status = "saved";
    });

    showToast(t("toast_batch_saved_success", { n: data.saved_count }), "success");
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    showToast(t("toast_save_failed", { err: err.message }), "error");
    if (saveAnalyzedAndStopBtn) {
      saveAnalyzedAndStopBtn.disabled = false;
      saveAnalyzedAndStopBtn.innerHTML = `
        <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/>
        </svg>
        <span>${t("progress_save_analyzed_btn", { n: idsToSave.length })}</span>
      `;
    }
  }
}

async function handleBatchAnalyzeSelected() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  activeAnalysisAbortController = new AbortController();
  isAnalysisCancelled = false;
  currentBatchAnalyzedIds = [];

  const total = ids.length;
  // Gemini free tier allows max 15 requests per minute (1 per 4 seconds)
  // We pace calls by ~4.1s to guarantee staying under the 15 RPM ceiling
  const PACING_DELAY_MS = 4100;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const analysisStartTime = Date.now();
  if (progressElapsedLabel) progressElapsedLabel.textContent = t("progress_stat_elapsed");
  if (progressElapsed) {
    progressElapsed.textContent = "00:00";
    progressElapsed.style.color = "var(--text)";
  }
  const stopwatchInterval = setInterval(() => {
    if (progressElapsed) {
      const elapsedSec = (Date.now() - analysisStartTime) / 1000;
      progressElapsed.textContent = formatStopwatch(elapsedSec);
    }
  }, 1000);

  if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
  if (batchProgressFill) {
    batchProgressFill.style.width = "0%";
    batchProgressFill.style.background = "var(--accent)";
  }
  progressModalTitle.textContent = t("progress_batch_analyzing");
  progressModalDesc.textContent = t("progress_batch_desc", { n: total });
  if (progressCount) progressCount.textContent = `0 / ${total}`;
  if (progressRemaining) progressRemaining.textContent = `${total}`;
  if (progressEta) progressEta.textContent = formatEtaTime(total * 4.2);
  if (progressStatusText) progressStatusText.textContent = t("progress_pacing_active");
  if (cancelProgressBtn) cancelProgressBtn.style.display = "inline-flex";
  if (closeProgressBtn) closeProgressBtn.style.display = "none";
  if (minimizeProgressBtn) minimizeProgressBtn.style.display = "inline-flex";
  if (saveAnalyzedAndStopBtn) {
    saveAnalyzedAndStopBtn.style.display = "none";
    saveAnalyzedAndStopBtn.disabled = false;
    saveAnalyzedAndStopBtn.innerHTML = `${ICONS.save} <span id="saveAnalyzedBtnText">${t("progress_save_analyzed_btn", { n: 0 })}</span>`;
    if (saveAnalyzedBtnText) saveAnalyzedBtnText.textContent = t("progress_save_analyzed_btn", { n: 0 });
  }
  progressModal.style.display = "flex";

  let done = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    if (isAnalysisCancelled) break;
    const tid = ids[i];
    const track = state.tracks.find(t => t.id === tid);
    const trackName = track ? `${track.artist || '—'} - ${track.title || track.file_name}` : `Track #${tid}`;

    const remainingCount = total - done;
    const estSeconds = remainingCount * 4.2;

    progressModalTitle.textContent = t("progress_batch_analyzing");
    progressModalDesc.textContent = `[${i + 1}/${total}] Analyzing: ${trackName}`;
    if (progressCount) progressCount.textContent = `${done} / ${total}`;
    if (minimizedBatchProgressText) minimizedBatchProgressText.textContent = `${done} / ${total}`;
    if (progressRemaining) progressRemaining.textContent = `${remainingCount}`;
    if (progressEta) progressEta.textContent = formatEtaTime(estSeconds);
    if (progressStatusText) progressStatusText.textContent = t("progress_pacing_active");

    let success = false;
    let attempts = 0;
    const MAX_RETRIES = 4;

    while (!success && attempts < MAX_RETRIES && !isAnalysisCancelled) {
      attempts++;
      const startTime = Date.now();
      try {
        const res = await fetch(`/api/analyze/${tid}`, {
          method: "POST",
          signal: activeAnalysisAbortController.signal
        });

        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = (errData.detail || "").toLowerCase();
          const isDaily = errData.is_daily_limit || errMsg.includes("daily") || errMsg.includes("generaterequestsperday") || errMsg.includes("limit: 500");

          if (isDaily) {
            console.warn(`[Batch] Daily quota exhausted across all models! Halting batch.`);
            isAnalysisCancelled = true;
            if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.cancelled;
            if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
            progressModalTitle.textContent = t("progress_daily_quota_title");
            progressModalDesc.textContent = t("progress_daily_quota_desc", { n: done });
            if (progressStatusText) progressStatusText.textContent = t("progress_daily_limit_status");
            if (cancelProgressBtn) cancelProgressBtn.style.display = "none";
            if (closeProgressBtn) closeProgressBtn.style.display = "inline-flex";
            if (done > 0 && saveAnalyzedAndStopBtn) {
              saveAnalyzedAndStopBtn.style.display = "inline-flex";
              saveAnalyzedAndStopBtn.disabled = false;
              saveAnalyzedAndStopBtn.innerHTML = `${ICONS.save} <span id="saveAnalyzedBtnText">${t("progress_save_analyzed_btn", { n: done })}</span>`;
              if (saveAnalyzedBtnText) {
                saveAnalyzedBtnText.textContent = t("progress_save_analyzed_btn", { n: done });
              }
            }
            break;
          }

          // Rate limit reached: extract retry-after or default to 15s cooldown
          const retryAfterSec = errData.retry_after || parseInt(res.headers.get("Retry-After") || "15", 10) || 15;
          console.warn(`[Batch] 429 Rate Limit on track ${tid}. Cooling down for ${retryAfterSec}s... (Attempt ${attempts}/${MAX_RETRIES})`);
          
          if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
          if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
          progressModalTitle.textContent = t("progress_ratelimit_title");

          for (let sec = retryAfterSec; sec > 0; sec--) {
            if (isAnalysisCancelled) break;
            progressModalDesc.textContent = `Free-tier limit reached. Retrying track [${i + 1}/${total}] in ${sec}s... (Attempt ${attempts}/${MAX_RETRIES})`;
            if (progressEta) progressEta.textContent = formatEtaTime(estSeconds + sec);
            if (progressStatusText) progressStatusText.textContent = t("progress_cooldown_active", { sec });
            await sleep(1000);
          }

          if (isAnalysisCancelled) break;
          if (batchProgressFill) batchProgressFill.style.background = "var(--accent)";
          progressModalTitle.textContent = t("progress_batch_analyzing");
          progressModalDesc.textContent = `Retrying track [${i + 1}/${total}]: ${trackName}...`;
          if (progressStatusText) progressStatusText.textContent = t("progress_pacing_active");
          continue; // retry same track
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.detail || `Server status ${res.status}`;
          const errLower = errMsg.toLowerCase();
          const isDaily = errData.is_daily_limit || errLower.includes("daily") || errLower.includes("generaterequestsperday") || errLower.includes("limit: 500");
          if (isDaily) {
            console.warn(`[Batch] Daily quota exhausted across all models! Halting batch.`);
            isAnalysisCancelled = true;
            if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.cancelled;
            if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
            progressModalTitle.textContent = t("progress_daily_quota_title");
            progressModalDesc.textContent = t("progress_daily_quota_desc", { n: done });
            if (progressStatusText) progressStatusText.textContent = t("progress_daily_limit_status");
            if (cancelProgressBtn) cancelProgressBtn.style.display = "none";
            if (closeProgressBtn) closeProgressBtn.style.display = "inline-flex";
            if (done > 0 && saveAnalyzedAndStopBtn) {
              saveAnalyzedAndStopBtn.style.display = "inline-flex";
              saveAnalyzedAndStopBtn.disabled = false;
              saveAnalyzedAndStopBtn.innerHTML = `${ICONS.save} <span id="saveAnalyzedBtnText">${t("progress_save_analyzed_btn", { n: done })}</span>`;
              if (saveAnalyzedBtnText) {
                saveAnalyzedBtnText.textContent = t("progress_save_analyzed_btn", { n: done });
              }
            }
            break;
          }
          if (errLower.includes("rate limit") || errLower.includes("resourceexhausted")) {
            console.warn(`[Batch] Rate limit in error message: ${errMsg}. Cooling down...`);
            if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
            progressModalTitle.textContent = t("progress_ratelimit_title");
            for (let sec = 15; sec > 0; sec--) {
              if (isAnalysisCancelled) break;
              progressModalDesc.textContent = `Retrying track [${i + 1}/${total}] in ${sec}s...`;
              if (progressEta) progressEta.textContent = formatEtaTime(estSeconds + sec);
              if (progressStatusText) progressStatusText.textContent = t("progress_cooldown_active", { sec });
              await sleep(1000);
            }
            if (batchProgressFill) batchProgressFill.style.background = "var(--accent)";
            continue;
          }
          throw new Error(errMsg);
        }

        success = true;
        done++;
        currentBatchAnalyzedIds.push(tid);
        if (saveAnalyzedAndStopBtn) {
          saveAnalyzedAndStopBtn.style.display = "inline-flex";
          saveAnalyzedAndStopBtn.disabled = false;
          saveAnalyzedAndStopBtn.innerHTML = `${ICONS.save} <span id="saveAnalyzedBtnText">${t("progress_stop_and_save_btn", { n: done })}</span>`;
          if (saveAnalyzedBtnText) {
            saveAnalyzedBtnText.textContent = t("progress_stop_and_save_btn", { n: done });
          }
        }
        const currentRemaining = total - done;
        batchProgressFill.style.width = `${(done / total) * 100}%`;
        if (progressCount) progressCount.textContent = `${done} / ${total}`;
        if (minimizedBatchProgressText) minimizedBatchProgressText.textContent = `${done} / ${total}`;
        if (progressRemaining) progressRemaining.textContent = `${currentRemaining}`;
        if (progressEta) progressEta.textContent = formatEtaTime(currentRemaining * 4.2);

        // If there are more tracks, pace requests to stay under 15 RPM
        if (i < ids.length - 1 && !isAnalysisCancelled) {
          const elapsed = Date.now() - startTime;
          const waitTime = Math.max(0, PACING_DELAY_MS - elapsed);
          if (waitTime > 200) {
            progressModalDesc.textContent = `Pacing free tier (15 RPM)... next in ${Math.ceil(waitTime / 1000)}s`;
            await sleep(waitTime);
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || isAnalysisCancelled) {
          break;
        }
        console.warn(`Analysis error on track ${tid} (attempt ${attempts}):`, e);
        if (attempts >= MAX_RETRIES) {
          failed++;
        } else {
          await sleep(2500);
        }
      }
    }
  }

  clearInterval(stopwatchInterval);
  const totalElapsedSec = (Date.now() - analysisStartTime) / 1000;
  const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : "id";
  const readableRuntime = formatReadableRuntime(totalElapsedSec, currentLang);

  if (cancelProgressBtn) cancelProgressBtn.style.display = "none";
  if (closeProgressBtn) closeProgressBtn.style.display = "inline-flex";
  if (minimizeProgressBtn) minimizeProgressBtn.style.display = "none";

  if (minimizedBatchProgress && minimizedBatchProgress.style.display !== "none") {
    progressModal.style.display = "flex";
    minimizedBatchProgress.style.display = "none";
  }

  if (isAnalysisCancelled) {
    if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.cancelled;
    if (batchProgressFill) batchProgressFill.style.background = "var(--warn)";
    const isDailyTitle = progressModalTitle.textContent.includes("Batas") || progressModalTitle.textContent.includes("Daily");
    if (!isDailyTitle) {
      progressModalTitle.textContent = t("progress_cancelled_title");
      progressModalDesc.textContent = t("progress_cancelled_desc", { done, total });
    }
    if (progressRemaining) progressRemaining.textContent = `${total - done}`;
    if (progressEta) progressEta.textContent = "—";
    if (progressElapsedLabel) progressElapsedLabel.textContent = t("progress_stat_runtime");
    if (progressElapsed) {
      progressElapsed.textContent = formatStopwatch(totalElapsedSec);
      progressElapsed.style.color = "var(--warn)";
    }
    if (done > 0 && saveAnalyzedAndStopBtn) {
      saveAnalyzedAndStopBtn.style.display = "inline-flex";
      saveAnalyzedAndStopBtn.disabled = false;
      if (saveAnalyzedBtnText) {
        saveAnalyzedBtnText.textContent = t("progress_save_analyzed_btn", { n: done });
      }
    }
    showToast(t("toast_analysis_cancelled"), "info");
  } else {
    if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.completed;
    if (batchProgressFill) {
      batchProgressFill.style.width = "100%";
      batchProgressFill.style.background = "var(--ok)";
    }
    progressModalTitle.textContent = t("progress_batch_done_title");
    progressModalDesc.textContent = t("progress_batch_done_with_runtime", { done, total, runtime: readableRuntime });
    if (progressRemaining) progressRemaining.textContent = "0";
    if (progressEta) progressEta.textContent = "0s";
    if (progressElapsedLabel) progressElapsedLabel.textContent = t("progress_stat_runtime");
    if (progressElapsed) {
      progressElapsed.textContent = formatStopwatch(totalElapsedSec);
      progressElapsed.style.color = "var(--ok)";
    }
    if (progressStatusText) progressStatusText.textContent = t("progress_stat_done_runtime", { runtime: readableRuntime });
    if (done > 0 && saveAnalyzedAndStopBtn) {
      saveAnalyzedAndStopBtn.style.display = "inline-flex";
      saveAnalyzedAndStopBtn.disabled = false;
      if (saveAnalyzedBtnText) {
        saveAnalyzedBtnText.textContent = t("progress_save_all_btn", { n: done });
      }
    }
    playAnalysisCompleteSound();
    showToast(t("toast_batch_analyzed_runtime", { n: done, runtime: readableRuntime }), "success");
  }

  activeAnalysisAbortController = null;
  await fetchTaxonomies();
  await fetchStats();
  await fetchTracks();
}

async function handleBatchTagUntagged() {
  const untagged = state.tracks.filter(t => t.status === "unprocessed");
  if (untagged.length === 0) {
    showToast(t("toast_batch_all_tagged"), "info");
    return;
  }

  untagged.forEach(t => state.selectedIds.add(t.id));
  updateSelectionUI();
  handleBatchAnalyzeSelected();
}

async function handleBatchApplySelected() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  applySelectedBtn.disabled = true;
  applySelectedBtn.querySelector("span").textContent = "...";

  const total = ids.length;
  if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.spinner;
  if (batchProgressFill) {
    batchProgressFill.style.width = "20%";
    batchProgressFill.style.background = "var(--accent)";
  }
  progressModalTitle.textContent = t("progress_batch_saving_title");
  progressModalDesc.textContent = t("progress_batch_saving_desc");
  if (progressCount) progressCount.textContent = `0 / ${total}`;
  if (progressRemaining) progressRemaining.textContent = `${total}`;
  if (progressEta) progressEta.textContent = `~${Math.max(1, Math.ceil(total * 0.05))}s`;
  if (progressStatusText) progressStatusText.textContent = t("progress_writing_disk");
  if (cancelProgressBtn) cancelProgressBtn.style.display = "none";
  if (closeProgressBtn) closeProgressBtn.style.display = "none";
  progressModal.style.display = "flex";

  const saveStartTime = Date.now();
  if (progressElapsedLabel) progressElapsedLabel.textContent = t("progress_stat_elapsed");
  if (progressElapsed) {
    progressElapsed.textContent = "00:00";
    progressElapsed.style.color = "var(--text)";
  }
  const saveStopwatch = setInterval(() => {
    if (progressElapsed) {
      const elapsedSec = (Date.now() - saveStartTime) / 1000;
      progressElapsed.textContent = formatStopwatch(elapsedSec);
    }
  }, 1000);

  // Mark selected rows in table as saving
  ids.forEach(id => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      const sc = row.querySelector(".status-cell");
      if (sc) sc.innerHTML = `<span class="status-dot saving"></span><span>${t("status_saving_label")}</span>`;
    }
  });

  try {
    if (batchProgressFill) batchProgressFill.style.width = "65%";
    const res = await fetch("/api/batch-apply-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: ids })
    });
    clearInterval(saveStopwatch);
    const saveDurationSec = (Date.now() - saveStartTime) / 1000;
    const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : "id";
    const readableSaveRuntime = formatReadableRuntime(saveDurationSec, currentLang);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Batch save failed");
    }
    const data = await res.json();
    
    if (batchProgressFill) {
      batchProgressFill.style.width = "100%";
      batchProgressFill.style.background = "var(--ok)";
    }
    if (progressModalIcon) progressModalIcon.innerHTML = PROGRESS_ICONS.completed;
    progressModalTitle.textContent = t("progress_batch_saved_title");
    progressModalDesc.textContent = `${t("toast_batch_saved_success", { n: data.saved_count })} (${readableSaveRuntime})`;
    if (progressCount) progressCount.textContent = `${data.saved_count} / ${total}`;
    if (progressRemaining) progressRemaining.textContent = "0";
    if (progressEta) progressEta.textContent = t("progress_eta_done");
    if (progressElapsedLabel) progressElapsedLabel.textContent = t("progress_stat_runtime");
    if (progressElapsed) {
      progressElapsed.textContent = formatStopwatch(saveDurationSec);
      progressElapsed.style.color = "var(--ok)";
    }
    if (progressStatusText) progressStatusText.textContent = t("progress_stat_saved_runtime", { runtime: readableSaveRuntime });
    if (closeProgressBtn) closeProgressBtn.style.display = "inline-flex";

    // Update track status in state
    state.tracks.forEach(t => {
      if (ids.includes(t.id)) t.status = "saved";
    });

    showToast(t("toast_batch_saved_success", { n: data.saved_count }), "success");
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    progressModal.style.display = "none";
    showToast(t("toast_save_failed", { err: err.message }), "error");
    await fetchTracks();
  } finally {
    applySelectedBtn.disabled = false;
    updateSelectionUI();
  }
}

// Edit Modal
window.handleEditTrack = function(id) {
  const t = state.tracks.find(x => x.id === id);
  if (!t) return;

  document.getElementById("editTrackId").value = t.id;
  document.getElementById("editTitle").value = t.title || "";
  document.getElementById("editArtist").value = t.artist || "";
  document.getElementById("editYear").value = t.release_year || "";
  document.getElementById("editDecade").value = t.decade || "";
  document.getElementById("editParentGenre").value = t.parent_genre || "";
  document.getElementById("editGenre").value = t.genre || "";
  document.getElementById("editSubGenre").value = t.sub_genre || "";
  document.getElementById("editTempo").value = t.tempo || "";
  document.getElementById("editTagsInput").value = (t.tags || []).join(", ");

  const aiNotesSection = document.getElementById("aiNotesSection");
  const aiNotesDisplay = document.getElementById("aiNotesDisplay");
  if (t.ai_notes) {
    aiNotesSection.style.display = "block";
    aiNotesDisplay.textContent = t.ai_notes;
  } else {
    aiNotesSection.style.display = "none";
  }

  editModal.style.display = "flex";
};

async function saveEditTrack(writeToFile) {
  const id = parseInt(document.getElementById("editTrackId").value);
  const tagsArr = document.getElementById("editTagsInput").value.split(",").map(s => s.trim()).filter(Boolean);
  const yr = document.getElementById("editYear").value ? parseInt(document.getElementById("editYear").value) : null;

  const payload = {
    title: document.getElementById("editTitle").value.trim(),
    artist: document.getElementById("editArtist").value.trim(),
    release_year: yr,
    decade: document.getElementById("editDecade").value.trim(),
    parent_genre: document.getElementById("editParentGenre").value.trim(),
    genre: document.getElementById("editGenre").value.trim(),
    sub_genre: document.getElementById("editSubGenre").value.trim(),
    tempo: document.getElementById("editTempo").value.trim() || null,
    tags: tagsArr
  };

  try {
    await fetch(`/api/track/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const trkMaster = (state.allTracks || []).find(t => t.id === id);
    if (trkMaster) Object.assign(trkMaster, payload);

    if (writeToFile) {
      const origHtml = saveAndWriteFileBtn.innerHTML;
      saveAndWriteFileBtn.disabled = true;
      saveAndWriteFileBtn.innerHTML = `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>${t("status_saving_label")}</span>`;
      try {
        await fetch(`/api/apply-tags/${id}`, { method: "POST" });
        showToast(t("edit_success_file"), "success");
      } finally {
        saveAndWriteFileBtn.disabled = false;
        saveAndWriteFileBtn.innerHTML = origHtml;
      }
    } else {
      showToast(t("edit_success_suggest"), "success");
    }

    editModal.style.display = "none";
    await fetchTaxonomies();
    await fetchStats();
    await fetchTracks();
  } catch (err) {
    showToast(t("toast_save_failed", { err: err.message }), "error");
  }
}

// AI Model Selection & Cascade Management
function renderModelCascadeUI() {
  if (!modelSelectionList || !cascadeFlowPreview) return;

  const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : "en";
  const cascade = state.modelCascade || [];

  // 1. Render Flow Preview Breadcrumb
  if (cascade.length === 0) {
    cascadeFlowPreview.innerHTML = `<span style="color:var(--warn); font-size:11px;">⚠️ ${t("settings_model_min_error")}</span>`;
  } else if (cascade.length === 1) {
    const m = AVAILABLE_MODELS.find(x => x.id === cascade[0]) || { name: cascade[0] };
    cascadeFlowPreview.innerHTML = `
      <span class="cascade-node single">1. ${escapeHtml(m.name || cascade[0])}</span>
      <span style="font-size:10px; color:var(--text-3); font-style:italic;">${t("settings_model_single_notice")}</span>
    `;
  } else {
    let flowHtml = "";
    cascade.forEach((mid, idx) => {
      const m = AVAILABLE_MODELS.find(x => x.id === mid) || { name: mid };
      const isPrimary = idx === 0;
      flowHtml += `
        <span class="cascade-node ${isPrimary ? 'primary' : ''}">
          ${idx + 1}. ${escapeHtml(m.name || mid)} ${isPrimary ? `(${t('settings_model_primary')})` : ''}
        </span>
      `;
      if (idx < cascade.length - 1) {
        flowHtml += `<span>➔</span>`;
      }
    });
    cascadeFlowPreview.innerHTML = flowHtml;
  }

  // 2. Render Checklist Items
  // Order: show models currently selected first in cascade order, followed by unselected models
  const unselectedModels = AVAILABLE_MODELS.filter(m => !cascade.includes(m.id));
  const orderedModels = [
    ...cascade.map(id => AVAILABLE_MODELS.find(m => m.id === id) || { id, name: id, tierClass: "tier-mid", tierName: "Custom", quotaBadge: "", desc_en: "", desc_id: "" }),
    ...unselectedModels
  ];

  let listHtml = "";
  orderedModels.forEach((m) => {
    const isSelected = cascade.includes(m.id);
    const orderIndex = cascade.indexOf(m.id); // 0-based
    const isPrimary = orderIndex === 0;
    const desc = currentLang === "id" ? (m.desc_id || m.desc_en) : (m.desc_en || m.desc_id);

    let orderBadgeHtml = "";
    if (isSelected) {
      if (isPrimary) {
        orderBadgeHtml = `<span class="order-badge primary">#1 ${t("settings_model_primary")}</span>`;
      } else {
        orderBadgeHtml = `<span class="order-badge fallback">#${orderIndex + 1} ${t("settings_model_fallback", { n: orderIndex })}</span>`;
      }
    } else {
      orderBadgeHtml = `<span class="order-badge disabled">Off</span>`;
    }

    const canMoveUp = isSelected && orderIndex > 0;
    const canMoveDown = isSelected && orderIndex < cascade.length - 1;

    listHtml += `
      <div class="model-item ${isSelected ? 'selected' : ''} ${isPrimary ? 'primary' : ''}" data-model-id="${m.id}">
        <div class="model-item-left">
          <label class="checkbox-custom">
            <input type="checkbox" class="model-cascade-checkbox" data-model-id="${m.id}" ${isSelected ? 'checked' : ''}>
            <span class="checkbox-box">${ICONS.check}</span>
          </label>
          <div class="model-info">
            <div class="model-title-row">
              <span class="model-name">${escapeHtml(m.name)}</span>
              <span class="model-id">${escapeHtml(m.id)}</span>
              <span class="model-badge ${m.tierClass}">${escapeHtml(m.tierName)}</span>
              ${m.quotaBadge ? `<span class="model-badge" style="background:rgba(255,255,255,0.06); color:var(--text-2);">${escapeHtml(m.quotaBadge)}</span>` : ''}
            </div>
            <span class="model-desc">${escapeHtml(desc)}</span>
          </div>
        </div>
        <div class="model-item-right">
          ${orderBadgeHtml}
          <div class="reorder-btns">
            <button type="button" class="btn-reorder" onclick="moveCascadeModelUp('${m.id}')" title="${t('settings_move_up')}" ${canMoveUp ? '' : 'disabled'}>▲</button>
            <button type="button" class="btn-reorder" onclick="moveCascadeModelDown('${m.id}')" title="${t('settings_move_down')}" ${canMoveDown ? '' : 'disabled'}>▼</button>
          </div>
        </div>
      </div>
    `;
  });

  modelSelectionList.innerHTML = listHtml;

  // Wire checkbox events
  modelSelectionList.querySelectorAll(".model-cascade-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const mid = e.target.dataset.modelId;
      if (e.target.checked) {
        if (!state.modelCascade.includes(mid)) {
          state.modelCascade.push(mid);
        }
      } else {
        if (state.modelCascade.length <= 1) {
          e.target.checked = true;
          showToast(t("settings_model_min_error"), "warn");
          return;
        }
        state.modelCascade = state.modelCascade.filter(x => x !== mid);
      }
      renderModelCascadeUI();
    });
  });
}

window.moveCascadeModelUp = function(mid) {
  const idx = state.modelCascade.indexOf(mid);
  if (idx > 0) {
    const temp = state.modelCascade[idx - 1];
    state.modelCascade[idx - 1] = state.modelCascade[idx];
    state.modelCascade[idx] = temp;
    renderModelCascadeUI();
  }
};

window.moveCascadeModelDown = function(mid) {
  const idx = state.modelCascade.indexOf(mid);
  if (idx !== -1 && idx < state.modelCascade.length - 1) {
    const temp = state.modelCascade[idx + 1];
    state.modelCascade[idx + 1] = state.modelCascade[idx];
    state.modelCascade[idx] = temp;
    renderModelCascadeUI();
  }
};

// Settings Modal
async function openSettings() {
  try {
    const res = await fetch("/api/settings");
    const s = await res.json();
    settingsApiKey.value = "";
    settingsApiKey.placeholder = s.has_api_key ? s.gemini_api_key_masked : t("settings_api_placeholder");
    if (s.tag_separator) settingsSeparator.value = s.tag_separator;
    if (s.write_custom_frames !== undefined) settingsWriteCustom.checked = s.write_custom_frames;
    if (s.analyze_tempo !== undefined) {
      if (settingsAnalyzeTempo) settingsAnalyzeTempo.checked = s.analyze_tempo;
      if (sidebarAnalyzeTempoCheckbox) sidebarAnalyzeTempoCheckbox.checked = s.analyze_tempo;
    }
    const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : (s.language || "en");
    if (settingsLanguage) settingsLanguage.value = currentLang;

    if (s.model_cascade && Array.isArray(s.model_cascade) && s.model_cascade.length > 0) {
      state.modelCascade = [...s.model_cascade];
    }
    renderModelCascadeUI();

    settingsModal.style.display = "flex";
  } catch (err) {
    console.error("Open settings error:", err);
  }
}

async function saveSettingsData() {
  const newKey = settingsApiKey.value.trim();
  const sep = settingsSeparator.value;
  const customFrames = settingsWriteCustom.checked;
  const analyzeTempo = settingsAnalyzeTempo ? settingsAnalyzeTempo.checked : true;
  const lang = settingsLanguage ? settingsLanguage.value : (window.getCurrentLanguage ? window.getCurrentLanguage() : "en");

  if (!state.modelCascade || state.modelCascade.length === 0) {
    showToast(t("settings_model_min_error"), "warn");
    return;
  }

  if (window.setLanguage) {
    window.setLanguage(lang);
  }

  const payload = {
    tag_separator: sep,
    write_custom_frames: customFrames,
    analyze_tempo: analyzeTempo,
    language: lang,
    model_cascade: state.modelCascade
  };
  if (sidebarAnalyzeTempoCheckbox) {
    sidebarAnalyzeTempoCheckbox.checked = analyzeTempo;
  }
  if (newKey) {
    payload.gemini_api_key = newKey;
  }

  try {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showToast(t("toast_settings_saved"), "success");
    settingsModal.style.display = "none";
    await checkSettingsStatus();
  } catch (err) {
    showToast(t("toast_settings_save_failed", { err: err.message }), "error");
  }
}

function resetAllFilters() {
  if (searchInput) searchInput.value = "";
  if (clearSearchBtn) clearSearchBtn.style.display = "none";
  state.filters.search = "";
  state.filters.decade = "All";
  state.filters.parent_genre = "All";
  state.filters.genre = "All";
  state.filters.sub_genre = "All";
  state.filters.status = "All";

  if (genreFilter) genreFilter.value = "All";
  if (subGenreFilter) subGenreFilter.value = "All";

  if (statusRailList) {
    statusRailList.querySelectorAll(".rail-item").forEach(i => {
      i.classList.toggle("active", i.dataset.status === "All");
    });
  }

  renderRailDecades();
  renderRailParentGenres();
  fetchTracks();
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    setTimeout(() => toast.remove(), 150);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTrackCoverUrl(trackId, version = null) {
  if (!trackId) return "";
  if (version) return `/api/cover/${trackId}?v=${version}`;
  return `/api/cover/${trackId}`;
}
window.getTrackCoverUrl = getTrackCoverUrl;

// ==========================================================================
// SPOTIFY-STYLE PLAYER MODE & PLAYLIST LOGIC
// ==========================================================================

function initPlayerMode() {
  // Mode switcher buttons
  if (modeStudioBtn) {
    modeStudioBtn.addEventListener("click", () => switchAppMode("studio"));
  }
  if (modePlayerBtn) {
    modePlayerBtn.addEventListener("click", () => switchAppMode("player"));
  }

  // Infinite scroll listener for progressive tracklist rendering in Player Mode
  if (spContentScroll) {
    spContentScroll.addEventListener("scroll", () => {
      if (!window._activeTracklistData) return;
      const { tracks, renderedCount, isLoadingChunk } = window._activeTracklistData;
      if (isLoadingChunk || renderedCount >= tracks.length) return;
      const scrollBottom = spContentScroll.scrollHeight - spContentScroll.scrollTop - spContentScroll.clientHeight;
      if (scrollBottom < 600) {
        appendNextTracklistChunk();
      }
    }, { passive: true });
  }

  // Navigation sidebar buttons
  const navBtns = [
    { btn: spNavHomeBtn, view: "home" },
    { btn: spNavAllTracksBtn, view: "all-tracks" },
    { btn: spNavLikedBtn, view: "liked" },
    { btn: spNavArtistsBtn, view: "artists" },
    { btn: spNavAlbumsBtn, view: "albums" },
    { btn: spNavDecadesBtn, view: "decades" },
    { btn: spNavGenresBtn, view: "genres" },
    { btn: spNavTempoBtn, view: "tempo" }
  ];
  navBtns.forEach(({ btn, view }) => {
    if (btn) {
      btn.addEventListener("click", () => {
        state.playerView = view;
        state.activePlaylistId = null;
        state.activeFilterValue = null;
        updatePlayerNavActive();
        renderPlayerView(true);
      });
    }
  });

  // Like button in audio player bar
  if (playerLikeBtn) {
    playerLikeBtn.addEventListener("click", () => {
      if (state.currentPlayingTrack) {
        toggleTrackLike(state.currentPlayingTrack.id);
      }
    });
  }

  // Queue buttons
  if (navQueueBtn) {
    navQueueBtn.addEventListener("click", () => toggleQueueDrawer());
  }
  if (spQueueCloseBtn) {
    spQueueCloseBtn.addEventListener("click", () => toggleQueueDrawer(false));
  }
  if (spQueueClearBtn) {
    spQueueClearBtn.addEventListener("click", clearQueue);
  }

  // Playlist modal buttons
  if (spCreatePlaylistBtn) {
    spCreatePlaylistBtn.addEventListener("click", openCreatePlaylistModal);
  }
  if (closeNewPlaylistModalBtn) {
    closeNewPlaylistModalBtn.addEventListener("click", closeCreatePlaylistModal);
  }
  if (cancelNewPlaylistBtn) {
    cancelNewPlaylistBtn.addEventListener("click", closeCreatePlaylistModal);
  }
  if (submitNewPlaylistBtn) {
    submitNewPlaylistBtn.addEventListener("click", submitCreatePlaylist);
  }

  // Floating Context Menu Handlers
  if (ctxPlayNext) {
    ctxPlayNext.addEventListener("click", () => {
      if (state.contextTrack) {
        addToQueue(state.contextTrack, true);
      }
      hideContextMenu();
    });
  }
  if (ctxAddToQueue) {
    ctxAddToQueue.addEventListener("click", () => {
      if (state.contextTrack) {
        addToQueue(state.contextTrack, false);
      }
      hideContextMenu();
    });
  }
  if (ctxToggleLike) {
    ctxToggleLike.addEventListener("click", () => {
      if (state.contextTrack) {
        toggleTrackLike(state.contextTrack.id);
      }
      hideContextMenu();
    });
  }
  if (ctxAddToPlaylistParent) {
    ctxAddToPlaylistParent.addEventListener("click", (e) => {
      e.stopPropagation();
      showAddToPlaylistSubmenu(state.contextTrack, e);
    });
  }
  if (ctxOpenInStudio) {
    ctxOpenInStudio.addEventListener("click", () => {
      const track = state.contextTrack;
      hideContextMenu();
      if (track) {
        switchAppMode("studio");
        setTimeout(() => {
          if (window.handleEditTrack) window.handleEditTrack(track.id);
        }, 100);
      }
    });
  }

  // Close context menu on outside click
  document.addEventListener("click", (e) => {
    if (spContextMenu && spContextMenu.style.display !== "none" && !spContextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Check saved mode
  if (state.appMode === "player") {
    switchAppMode("player");
  }
}

function switchAppMode(mode) {
  state.appMode = mode;
  localStorage.setItem("soundscope_app_mode", mode);

  if (modeStudioBtn) modeStudioBtn.classList.toggle("active", mode === "studio");
  if (modePlayerBtn) modePlayerBtn.classList.toggle("active", mode === "player");

  const appContainer = document.querySelector(".app-container");
  if (appContainer) {
    appContainer.classList.toggle("mode-player", mode === "player");
    appContainer.classList.toggle("mode-studio", mode === "studio");
  }

  if (studioModeView) studioModeView.style.display = mode === "studio" ? "flex" : "none";
  if (playerModeView) playerModeView.style.display = mode === "player" ? "flex" : "none";

  if (mode === "player") {
    loadPlaylists();
    updatePlayerNavActive();
    renderPlayerView(false);
    renderQueueUI();
  } else {
    renderTracks();
  }
}

function updatePlayerNavActive() {
  const navMap = {
    "home": spNavHomeBtn,
    "all-tracks": spNavAllTracksBtn,
    "liked": spNavLikedBtn,
    "artists": spNavArtistsBtn,
    "albums": spNavAlbumsBtn,
    "decades": spNavDecadesBtn,
    "genres": spNavGenresBtn,
    "tempo": spNavTempoBtn
  };
  Object.keys(navMap).forEach(v => {
    if (navMap[v]) navMap[v].classList.toggle("active", state.playerView === v && !state.activePlaylistId);
  });
  if (spPlaylistList) {
    spPlaylistList.querySelectorAll(".sp-playlist-item").forEach(item => {
      item.classList.toggle("active", parseInt(item.dataset.id) === state.activePlaylistId);
    });
  }
}

// --- Queue Management ---
function addToQueue(track, playNext = false) {
  if (!track) return;
  if (playNext) {
    state.queue.unshift(track);
    showToast(`"${track.title || track.file_name}" ${t("pm_play_next")}`, "ok");
  } else {
    state.queue.push(track);
    showToast(`"${track.title || track.file_name}" ${t("pm_track_added_queue")}`, "ok");
  }
  renderQueueUI();
}

function removeFromQueue(idx) {
  state.queue.splice(idx, 1);
  renderQueueUI();
}

function clearQueue() {
  state.queue = [];
  renderQueueUI();
  showToast(t("pm_queue_clear"), "info");
}

function toggleQueueDrawer(forceOpen) {
  if (!spQueueDrawer) return;
  if (typeof forceOpen === "boolean") {
    spQueueDrawer.classList.toggle("open", forceOpen);
  } else {
    spQueueDrawer.classList.toggle("open");
  }
  if (spQueueDrawer.classList.contains("open")) {
    renderQueueUI();
  }
}

function renderQueueUI() {
  if (!queueNowPlayingItem || !queueUpNextList) return;

  // Now playing card
  if (state.currentPlayingTrack) {
    const trk = state.currentPlayingTrack;
    const art = trk.has_cover
      ? `<img src="${getTrackCoverUrl(trk.id, trk.cover_v)}" loading="lazy" decoding="async" alt="">`
      : ICONS.disc;
    queueNowPlayingItem.innerHTML = `
      <div class="queue-track-thumb">${art}</div>
      <div class="queue-track-info">
        <div class="queue-track-name">${escapeHtml(trk.title || trk.file_name)}</div>
        <div class="queue-track-artist">${escapeHtml(trk.artist || "—")}</div>
      </div>
    `;
    queueNowPlayingItem.style.display = "flex";
  } else {
    queueNowPlayingItem.innerHTML = `<div style="color:var(--text-3); font-size:12px;">${t("player_no_track")}</div>`;
  }

  // Up next list
  if (state.queue.length === 0) {
    queueUpNextList.innerHTML = `<div style="color:var(--text-3); font-size:12px; padding:10px 4px;">${t("pm_queue_empty")}</div>`;
  } else {
    queueUpNextList.innerHTML = state.queue.map((track, idx) => {
      const art = track.has_cover
        ? `<img src="${getTrackCoverUrl(track.id, track.cover_v)}" loading="lazy" decoding="async" alt="">`
        : ICONS.disc;
      return `
        <div class="queue-item">
          <div class="queue-track-thumb" style="width:34px; height:34px;">${art}</div>
          <div class="queue-track-info" style="flex:1;">
            <div class="queue-track-name">${escapeHtml(track.title || track.file_name)}</div>
            <div class="queue-track-artist">${escapeHtml(track.artist || "—")}</div>
          </div>
          <button class="queue-item-remove" onclick="removeFromQueue(${idx})" title="${t('pm_queue_remove_tip')}">
            <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
    }).join("");
  }
}
window.removeFromQueue = removeFromQueue;

// --- Playlist Management ---
async function loadPlaylists() {
  try {
    const res = await fetch("/api/playlists");
    if (res.ok) {
      state.playlists = await res.json();
      renderSidebarPlaylists();
    }
  } catch (err) {
    console.error("Error loading playlists:", err);
  }
}

function renderSidebarPlaylists() {
  if (!spPlaylistList) return;
  if (!state.playlists || state.playlists.length === 0) {
    spPlaylistList.innerHTML = `
      <div style="padding:10px; color:var(--text-3); font-size:11px; text-align:center;">
        Belum ada playlist.<br>Klik + untuk membuat.
      </div>
    `;
    return;
  }

  spPlaylistList.innerHTML = state.playlists.map(pl => `
    <div class="sp-playlist-item ${state.activePlaylistId === pl.id ? 'active' : ''}" data-id="${pl.id}" onclick="openPlaylistView(${pl.id})">
      <div class="sp-playlist-item-meta">
        <svg class="lucide" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <span class="sp-playlist-item-name">${escapeHtml(pl.name)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <span class="sp-playlist-item-count">${pl.track_count || 0}</span>
        <button class="sp-playlist-item-del" onclick="deletePlaylist(${pl.id}, event)" title="${t('pm_playlist_deleted')}">
          <svg class="lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}
window.openPlaylistView = openPlaylistView;
window.deletePlaylist = deletePlaylist;

function openCreatePlaylistModal() {
  if (newPlaylistNameInput) newPlaylistNameInput.value = "";
  if (newPlaylistDescInput) newPlaylistDescInput.value = "";
  if (newPlaylistModalBackdrop) newPlaylistModalBackdrop.style.display = "flex";
  if (newPlaylistNameInput) newPlaylistNameInput.focus();
}

function closeCreatePlaylistModal() {
  if (newPlaylistModalBackdrop) newPlaylistModalBackdrop.style.display = "none";
}

async function submitCreatePlaylist() {
  const name = newPlaylistNameInput ? newPlaylistNameInput.value.trim() : "";
  const desc = newPlaylistDescInput ? newPlaylistDescInput.value.trim() : "";
  if (!name) {
    showToast(t("toast_playlist_name_empty"), "warn");
    return;
  }
  try {
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc })
    });
    if (!res.ok) throw new Error(t("toast_create_playlist_failed", { err: res.statusText }));
    const newPl = await res.json();
    closeCreatePlaylistModal();
    showToast(t("pm_playlist_created"), "ok");
    await loadPlaylists();
    openPlaylistView(newPl.id);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deletePlaylist(id, e) {
  if (e) e.stopPropagation();
  if (!confirm(t("toast_confirm_delete_playlist"))) return;
  try {
    const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast(t("pm_playlist_deleted"), "info");
      await loadPlaylists();
      if (state.activePlaylistId === id) {
        state.playerView = "home";
        state.activePlaylistId = null;
        updatePlayerNavActive();
        renderPlayerView(true);
      }
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, "error");
  }
}

async function openPlaylistView(id) {
  state.playerView = "playlist";
  state.activePlaylistId = id;
  updatePlayerNavActive();
  renderPlaylistDetailView(id);
}

function exportPlaylistM3u(id) {
  window.open(`/api/playlists/${id}/export-m3u`, "_blank");
}
window.exportPlaylistM3u = exportPlaylistM3u;

async function addTracksToPlaylist(playlistId, trackIds) {
  try {
    const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds })
    });
    if (!res.ok) throw new Error(t("toast_add_track_failed", { err: res.statusText }));
    const pl = state.playlists.find(p => p.id === playlistId);
    const plName = pl ? pl.name : "Playlist";
    showToast(t("pm_track_added_playlist", { name: plName }), "ok");
    await loadPlaylists();
    if (state.playerView === "playlist" && state.activePlaylistId === playlistId) {
      renderPlaylistDetailView(playlistId);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.addTracksToPlaylist = addTracksToPlaylist;

async function removeTrackFromPlaylist(playlistId, trackId, e) {
  if (e) e.stopPropagation();
  try {
    const res = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: "DELETE" });
    if (res.ok) {
      showToast(t("pm_track_removed_playlist"), "info");
      await loadPlaylists();
      renderPlaylistDetailView(playlistId);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.removeTrackFromPlaylist = removeTrackFromPlaylist;

// --- Context Menu (•••) ---
function openContextMenu(track, clientX, clientY) {
  state.contextTrack = track;
  if (!spContextMenu) return;

  if (ctxToggleLikeText && ctxToggleLikeIcon) {
    const isLiked = track && !!track.is_liked;
    ctxToggleLikeText.textContent = isLiked ? t("unlike_song") : t("like_song");
    ctxToggleLikeIcon.setAttribute("fill", isLiked ? "#ef4444" : "none");
    ctxToggleLikeIcon.setAttribute("stroke", isLiked ? "#ef4444" : "currentColor");
  }

  spContextMenu.style.display = "block";
  const menuWidth = 200;
  const menuHeight = 160;
  let posX = clientX;
  let posY = clientY;

  if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
  if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

  spContextMenu.style.left = `${Math.max(10, posX)}px`;
  spContextMenu.style.top = `${Math.max(10, posY)}px`;
}
window.openContextMenu = openContextMenu;

function hideContextMenu() {
  if (spContextMenu) spContextMenu.style.display = "none";
}

function handleContextAddToPlaylist(playlistId) {
  if (!state.contextTrack) return;
  const trk = state.contextTrack;
  const pl = state.playlists.find(p => p.id === playlistId);
  if (pl) {
    addTracksToPlaylist(playlistId, [trk.id]);
  } else {
    showToast(t("toast_playlist_not_found"), "warn");
  }
}

function showAddToPlaylistSubmenu(track, e) {
  if (!track) return;
  if (!state.playlists || state.playlists.length === 0) {
    hideContextMenu();
    openCreatePlaylistModal();
    return;
  }
  let options = state.playlists.map(p => `${p.name} (#${p.id})`).join("\n");
  const chosen = prompt(`Pilih nama/nomor playlist untuk "${track.title || track.file_name}":\n\n${options}\n\nKetik nomor/nama playlist:`);
  if (!chosen) return;
  const target = state.playlists.find(p => p.id == chosen || p.name.toLowerCase() === chosen.toLowerCase().trim());
  if (target) {
    addTracksToPlaylist(target.id, [track.id]);
  } else {
    showToast(t("toast_playlist_not_found"), "warn");
  }
  hideContextMenu();
}

// --- View Renderers for Player Mode ---
function renderPlayerView(resetScroll = false) {
  if (!spContentScroll) return;
  if (resetScroll) spContentScroll.scrollTop = 0;

  switch (state.playerView) {
    case "home":
      renderPlayerHomeView();
      break;
    case "all-tracks":
      renderPlayerAllTracksView();
      break;
    case "liked":
      renderLikedTracksView();
      break;
    case "artists":
      renderArtistsGridView();
      break;
    case "albums":
      renderAlbumsGridView();
      break;
    case "decades":
      renderDecadesGridView();
      break;
    case "genres":
      renderGenresGridView();
      break;
    case "tempo":
      renderTempoGridView();
      break;
    case "playlist":
      if (state.activePlaylistId) renderPlaylistDetailView(state.activePlaylistId);
      else renderPlayerHomeView();
      break;
    case "artist-tracks":
      renderFilteredTracksView("artist", state.activeFilterValue);
      break;
    case "album-tracks":
      renderFilteredTracksView("album", state.activeFilterValue);
      break;
    case "decade-tracks":
      renderFilteredTracksView("decade", state.activeFilterValue);
      break;
    case "parent_genre-tracks":
      renderFilteredTracksView("parent_genre", state.activeFilterValue);
      break;
    case "tempo-tracks":
      renderFilteredTracksView("tempo", state.activeFilterValue);
      break;
    default:
      renderPlayerHomeView();
  }
}

// 1. Home View
function renderPlayerHomeView() {
  if (!spContentScroll) return;

  const hr = new Date().getHours();
  let greeting = hr < 12 ? "Selamat Pagi" : (hr < 18 ? "Selamat Sore" : "Selamat Malam");
  if (window.getCurrentLanguage && window.getCurrentLanguage() === "en") {
    greeting = hr < 12 ? "Good Morning" : (hr < 18 ? "Good Afternoon" : "Good Evening");
  }

  const quickPicks = state.tracks.slice(0, 6);

  const albumMap = {};
  state.tracks.forEach(trk => {
    if (trk.album) {
      if (!albumMap[trk.album]) {
        albumMap[trk.album] = { album: trk.album, artist: trk.artist, count: 0, sampleTrack: trk };
      }
      albumMap[trk.album].count++;
    }
  });
  const albums = Object.values(albumMap).slice(0, 6);

  const decades = (state.taxonomies.decades && state.taxonomies.decades.length > 0)
    ? state.taxonomies.decades
    : ["2020s", "2010s", "2000s", "1990s", "1980s", "1970s"];

  let quickPicksHtml = "";
  if (quickPicks.length > 0) {
    quickPicksHtml = `
      <div class="sp-hero">
        <h2 class="sp-hero-title">${greeting}</h2>
        <div class="sp-quick-grid">
          ${quickPicks.map(trk => {
            const art = trk.has_cover
              ? `<img src="${getTrackCoverUrl(trk.id, trk.cover_v)}" loading="lazy" decoding="async" alt="">`
              : ICONS.disc;
            return `
              <div class="sp-quick-card" onclick="playTrackById(${trk.id})">
                <div class="sp-quick-art">${art}</div>
                <div class="sp-quick-info">
                  <div class="sp-quick-name">${escapeHtml(trk.title || trk.file_name)}</div>
                  <div class="sp-quick-sub">${escapeHtml(trk.artist || "—")}</div>
                </div>
                <button class="sp-quick-play-btn" onclick="event.stopPropagation(); playTrackById(${trk.id})" title="${t('action_play_tip')}">
                  ${ICONS.play}
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  } else {
    quickPicksHtml = `
      <div class="sp-hero">
        <h2 class="sp-hero-title">${greeting}</h2>
        <p style="color:var(--text-3); font-size:13px;">Belum ada lagu yang dimuat. Gunakan tombol Scan untuk memindai lagu dari folder Anda.</p>
      </div>
    `;
  }

  let albumsSectionHtml = "";
  if (albums.length > 0) {
    albumsSectionHtml = `
      <section>
        <div class="sp-section-header">
          <h3 class="sp-section-title">${t("pm_nav_albums")}</h3>
          <button class="btn-text-dim" onclick="navigateToPlayerView('albums')">Lihat Semua</button>
        </div>
        <div class="sp-card-grid">
          ${albums.map(al => {
            const trk = al.sampleTrack;
            const art = trk && trk.has_cover
              ? `<img src="${getTrackCoverUrl(trk.id, trk.cover_v)}" loading="lazy" decoding="async" alt="">`
              : ICONS.disc;
            return `
              <div class="sp-card" onclick="openFilteredView('album', '${escapeHtml(al.album)}')">
                <div class="sp-card-art-wrap">
                  <div class="sp-card-art">${art}</div>
                  <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('album', '${escapeHtml(al.album)}')" title="Putar Album">
                    ${ICONS.play}
                  </button>
                </div>
                <div class="sp-card-meta">
                  <span class="sp-card-title">${escapeHtml(al.album)}</span>
                  <span class="sp-card-sub">${escapeHtml(al.artist || "—")} • ${al.count} lagu</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  let decadesSectionHtml = `
    <section>
      <div class="sp-section-header">
        <h3 class="sp-section-title">${t("pm_nav_decades")}</h3>
        <button class="btn-text-dim" onclick="navigateToPlayerView('decades')">Lihat Semua</button>
      </div>
      <div class="sp-card-grid">
        ${decades.slice(0, 6).map(dec => {
          const decCount = state.tracks.filter(tr => tr.decade === dec).length;
          return `
            <div class="sp-card" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), #141822);" onclick="openFilteredView('decade', '${dec}')">
              <div class="sp-card-art-wrap" style="background: radial-gradient(circle, rgba(245,158,11,0.2), #0b0f19); display:flex; align-items:center; justify-content:center;">
                <div style="font-size:24px; font-weight:800; color:var(--accent);">${dec}</div>
                <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('decade', '${dec}')" title="Putar Dekade ${dec}">
                  ${ICONS.play}
                </button>
              </div>
              <div class="sp-card-meta">
                <span class="sp-card-title">${dec} Hits</span>
                <span class="sp-card-sub">${decCount} lagu dalam koleksi</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;

  spContentScroll.innerHTML = `
    ${quickPicksHtml}
    ${albumsSectionHtml}
    ${decadesSectionHtml}
  `;
}

// 2. All Tracks View
function renderPlayerAllTracksView() {
  if (!spContentScroll) return;
  const tracks = state.tracks;

  spContentScroll.innerHTML = `
    <div class="sp-detail-header">
      <div class="sp-detail-art" style="background: linear-gradient(135deg, var(--accent), #b45309);">
        <svg class="lucide" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
        </svg>
      </div>
      <div class="sp-detail-info">
        <span class="sp-detail-type">KOLEKSI MUSIK</span>
        <h1 class="sp-detail-title">${t("pm_all_tracks")}</h1>
        <div class="sp-detail-stats" id="spDetailStats">
          <span>${t("pm_tracks_count", { n: tracks.length })}</span>
          <span>•</span>
          <span>${formatTotalDuration(tracks)}</span>
        </div>
      </div>
    </div>

    <div class="sp-detail-actions">
      <button class="sp-play-hero-btn" onclick="playAllCurrentList()" title="Putar Semua">
        <svg class="lucide" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button class="btn-secondary" onclick="shuffleAllCurrentList()" style="display:flex; align-items:center; gap:8px;">
        <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/>
          <path d="m18 2 4 4-4 4"/>
          <path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.1 8.6c.8 1.1 2 1.7 3.3 1.7H22"/>
          <path d="m18 22 4-4-4-4"/>
        </svg>
        <span>Acak (Shuffle)</span>
      </button>
    </div>

    ${buildFilterBarHtml()}

    <div id="spAllTracksTableContainer">
      ${buildTracklistTableHtml(tracks, false)}
    </div>
  `;
}

function matchTempo(trackTempo, targetTempo) {
  if (!trackTempo) return false;
  const lower = trackTempo.toLowerCase();
  if (targetTempo === "Very Fast") {
    return lower.includes("very fast");
  }
  if (targetTempo === "Fast") {
    return lower.includes("fast") && !lower.includes("very fast");
  }
  if (targetTempo === "Mid-tempo") {
    return lower.includes("mid");
  }
  if (targetTempo === "Slow") {
    return lower.includes("slow");
  }
  return false;
}

// Compute dynamic cascading taxonomies based on current filters
function getPlayerFilterOptions() {
  const all = Array.isArray(state.allTracks) && state.allTracks.length > 0
    ? state.allTracks
    : (Array.isArray(state.tracks) ? state.tracks : []);

  // 1. Base tracks respect liked filter
  const isLikedActive = state.filters.is_liked === "1";
  let baseTracks = isLikedActive ? all.filter(t => t.is_liked == 1) : all;

  // Also apply text search if user typed in search bar
  const searchTerm = (state.filters.search || "").trim().toLowerCase();
  if (searchTerm) {
    baseTracks = baseTracks.filter(t => {
      const title = (t.title || "").toLowerCase();
      const artist = (t.artist || "").toLowerCase();
      const album = (t.album || "").toLowerCase();
      const fileName = (t.file_name || "").toLowerCase();
      const pGenre = (t.parent_genre || "").toLowerCase();
      const genre = (t.genre || "").toLowerCase();
      const subGenre = (t.sub_genre || "").toLowerCase();
      return title.includes(searchTerm) || artist.includes(searchTerm) || album.includes(searchTerm) ||
        fileName.includes(searchTerm) || pGenre.includes(searchTerm) || genre.includes(searchTerm) || subGenre.includes(searchTerm);
    });
  }

  // Decades from base tracks
  const decadeCounts = {};
  baseTracks.forEach(t => {
    if (t.decade) {
      decadeCounts[t.decade] = (decadeCounts[t.decade] || 0) + 1;
    }
  });
  const availableDecades = Object.keys(decadeCounts).sort((a, b) => b.localeCompare(a));
  if (state.filters.decade !== "All" && !decadeCounts[state.filters.decade]) {
    state.filters.decade = "All";
  }

  // 2. Parent genres from tracks matching selected decade
  let tracksForParents = baseTracks;
  if (state.filters.decade && state.filters.decade !== "All") {
    tracksForParents = tracksForParents.filter(t => t.decade === state.filters.decade);
  }

  const parentCounts = {};
  tracksForParents.forEach(t => {
    if (t.parent_genre) {
      parentCounts[t.parent_genre] = (parentCounts[t.parent_genre] || 0) + 1;
    }
  });
  // ONLY show parent genres that exist in this selection (count > 0)
  const availableParents = Object.keys(parentCounts).sort((a, b) => a.localeCompare(b));
  if (state.filters.parent_genre !== "All" && !parentCounts[state.filters.parent_genre]) {
    state.filters.parent_genre = "All";
  }

  // 3. Core genres from tracks matching decade AND parent_genre
  let tracksForGenres = tracksForParents;
  if (state.filters.parent_genre && state.filters.parent_genre !== "All") {
    tracksForGenres = tracksForGenres.filter(t => t.parent_genre === state.filters.parent_genre);
  }

  const genreCounts = {};
  tracksForGenres.forEach(t => {
    if (t.genre) {
      genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    }
  });
  // ONLY show genres that exist in this selection (count > 0)
  const availableGenres = Object.keys(genreCounts).sort((a, b) => a.localeCompare(b));
  if (state.filters.genre !== "All" && !genreCounts[state.filters.genre]) {
    state.filters.genre = "All";
  }

  // 4. Sub-genres from tracks matching decade, parent_genre, AND genre
  let tracksForSubgenres = tracksForGenres;
  if (state.filters.genre && state.filters.genre !== "All") {
    tracksForSubgenres = tracksForSubgenres.filter(t => t.genre === state.filters.genre);
  }

  const subGenreCounts = {};
  tracksForSubgenres.forEach(t => {
    if (t.sub_genre) {
      subGenreCounts[t.sub_genre] = (subGenreCounts[t.sub_genre] || 0) + 1;
    }
  });
  // ONLY show subgenres that exist in this selection (count > 0)
  const availableSubGenres = Object.keys(subGenreCounts).sort((a, b) => a.localeCompare(b));
  if (state.filters.sub_genre !== "All" && !subGenreCounts[state.filters.sub_genre]) {
    state.filters.sub_genre = "All";
  }

  // 5. Tempos from tracks matching decade, parent_genre, genre, AND sub_genre
  let tracksForTempo = tracksForSubgenres;
  if (state.filters.sub_genre && state.filters.sub_genre !== "All") {
    tracksForTempo = tracksForTempo.filter(t => t.sub_genre === state.filters.sub_genre);
  }

  const tempoCounts = { "Slow": 0, "Mid-tempo": 0, "Fast": 0, "Very Fast": 0 };
  tracksForTempo.forEach(t => {
    if (!t.tempo) return;
    if (matchTempo(t.tempo, "Very Fast")) {
      tempoCounts["Very Fast"]++;
    } else if (matchTempo(t.tempo, "Mid-tempo")) {
      tempoCounts["Mid-tempo"]++;
    } else if (matchTempo(t.tempo, "Slow")) {
      tempoCounts["Slow"]++;
    } else if (matchTempo(t.tempo, "Fast")) {
      tempoCounts["Fast"]++;
    }
  });

  // ONLY show tempos that exist in this selection (count > 0)
  const allTemposOrder = ["Slow", "Mid-tempo", "Fast", "Very Fast"];
  const availableTempos = allTemposOrder.filter(tmp => tempoCounts[tmp] > 0);
  if (state.filters.tempo !== "All" && (!tempoCounts[state.filters.tempo] || tempoCounts[state.filters.tempo] === 0)) {
    state.filters.tempo = "All";
  }

  return {
    availableDecades,
    decadeCounts,
    availableParents,
    parentCounts,
    availableGenres,
    genreCounts,
    availableSubGenres,
    subGenreCounts,
    availableTempos,
    tempoCounts,
    totalBaseCount: baseTracks.length,
    tracksForParentsCount: tracksForParents.length,
    tracksForGenresCount: tracksForGenres.length,
    tracksForSubgenresCount: tracksForSubgenres.length,
    tracksForTempoCount: tracksForTempo.length
  };
}

// Filter Bar in Player Mode
function buildFilterBarHtml() {
  const opts = getPlayerFilterOptions();

  let activeFilterCount = 0;
  if (state.filters.decade && state.filters.decade !== "All") activeFilterCount++;
  if (state.filters.parent_genre && state.filters.parent_genre !== "All") activeFilterCount++;
  if (state.filters.genre && state.filters.genre !== "All") activeFilterCount++;
  if (state.filters.sub_genre && state.filters.sub_genre !== "All") activeFilterCount++;
  if (state.filters.tempo && state.filters.tempo !== "All") activeFilterCount++;
  if (state.filters.is_liked && state.filters.is_liked !== "All") activeFilterCount++;

  const hasActiveFilters = activeFilterCount > 0;

  const tempoLabels = {
    "Slow": t("tempo_slow"),
    "Mid-tempo": t("tempo_mid"),
    "Fast": t("tempo_fast"),
    "Very Fast": t("tempo_vfast")
  };

  return `
    <div class="sp-filter-bar" id="spFilterBar">
      <div class="sp-filter-bar-header">
        <div class="sp-filter-title">
          <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span data-i18n="filter_options_title">${t("filter_options_title")}</span>
        </div>
        ${hasActiveFilters ? `
          <button type="button" class="sp-reset-filter-btn" onclick="resetAllPlayerFilters()" title="${t('filter_reset')}">
            <svg class="lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span>${t("filter_active_n", { n: activeFilterCount })}</span>
          </button>
        ` : ''}
      </div>

      <div class="sp-filter-controls">
        <!-- Decades -->
        <div class="sp-filter-select-wrap">
          <label class="sp-filter-label" for="spFilterDecade">
            <span>📅</span> <span>${t("filter_decades")}</span>
          </label>
          <select id="spFilterDecade" class="sp-filter-select ${state.filters.decade !== 'All' ? 'active-filter' : ''}" onchange="handlePlayerFilterSelect('decade', this.value)">
            <option value="All">${t("filter_all_decades")} (${opts.totalBaseCount})</option>
            ${opts.availableDecades.map(d => `<option value="${escapeHtml(d)}" ${state.filters.decade === d ? 'selected' : ''}>${escapeHtml(d)} (${opts.decadeCounts[d] || 0})</option>`).join("")}
          </select>
        </div>

        <!-- Parent Genre -->
        <div class="sp-filter-select-wrap">
          <label class="sp-filter-label" for="spFilterParentGenre">
            <span>🏷️</span> <span>${t("filter_parent_genre")}</span>
          </label>
          <select id="spFilterParentGenre" class="sp-filter-select ${state.filters.parent_genre !== 'All' ? 'active-filter' : ''}" onchange="handlePlayerFilterSelect('parent_genre', this.value)">
            <option value="All">${t("filter_all_parents")} (${opts.tracksForParentsCount})</option>
            ${opts.availableParents.map(p => `<option value="${escapeHtml(p)}" ${state.filters.parent_genre === p ? 'selected' : ''}>${escapeHtml(p)} (${opts.parentCounts[p] || 0})</option>`).join("")}
          </select>
        </div>

        <!-- Core Genre (Dependent on Parent Genre & Decade) -->
        <div class="sp-filter-select-wrap">
          <label class="sp-filter-label" for="spFilterGenre">
            <span>🎸</span> <span>${t("filter_genre")}</span>
          </label>
          <select id="spFilterGenre" class="sp-filter-select ${state.filters.genre !== 'All' ? 'active-filter' : ''}" onchange="handlePlayerFilterSelect('genre', this.value)">
            <option value="All">${t("filter_all_genres")} (${opts.tracksForGenresCount})</option>
            ${opts.availableGenres.map(g => `<option value="${escapeHtml(g)}" ${state.filters.genre === g ? 'selected' : ''}>${escapeHtml(g)} (${opts.genreCounts[g] || 0})</option>`).join("")}
          </select>
        </div>

        <!-- Sub-Genre (Dependent on Genre, Parent Genre, Decade) -->
        <div class="sp-filter-select-wrap">
          <label class="sp-filter-label" for="spFilterSubGenre">
            <span>🎛️</span> <span>${t("filter_subgenre")}</span>
          </label>
          <select id="spFilterSubGenre" class="sp-filter-select ${state.filters.sub_genre !== 'All' ? 'active-filter' : ''}" onchange="handlePlayerFilterSelect('sub_genre', this.value)">
            <option value="All">${t("filter_all_subgenres")} (${opts.tracksForSubgenresCount})</option>
            ${opts.availableSubGenres.map(sg => `<option value="${escapeHtml(sg)}" ${state.filters.sub_genre === sg ? 'selected' : ''}>${escapeHtml(sg)} (${opts.subGenreCounts[sg] || 0})</option>`).join("")}
          </select>
        </div>

        <!-- Tempo / Pace -->
        <div class="sp-filter-select-wrap">
          <label class="sp-filter-label" for="spFilterTempo">
            <span>⚡</span> <span>${t("filter_tempo")}</span>
          </label>
          <select id="spFilterTempo" class="sp-filter-select ${state.filters.tempo !== 'All' ? 'active-filter' : ''}" onchange="handlePlayerFilterSelect('tempo', this.value)">
            <option value="All">${t("filter_all_tempos")} (${opts.tracksForTempoCount})</option>
            ${opts.availableTempos.map(tempoKey => `<option value="${tempoKey}" ${state.filters.tempo === tempoKey ? 'selected' : ''}>${escapeHtml(tempoLabels[tempoKey] || tempoKey)} (${opts.tempoCounts[tempoKey] || 0})</option>`).join("")}
          </select>
        </div>
      </div>

      <!-- Quick Pills Row (Liked + Tempo) -->
      <div class="sp-filter-quick-pills">
        <button type="button" class="sp-pill liked-pill ${state.filters.is_liked === '1' ? 'active' : ''}" onclick="togglePlayerLikedPill()" title="${t('filter_liked_only')}">
          <svg class="heart-icon" width="12" height="12" viewBox="0 0 24 24" fill="${state.filters.is_liked === '1' ? '#ffffff' : '#ef4444'}" stroke="${state.filters.is_liked === '1' ? '#ffffff' : '#ef4444'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
          <span>${t("filter_liked_only")}</span>
        </button>
        <span class="sp-quick-pills-label">${t("filter_tempo")}:</span>
        <button type="button" id="spPillTempoSlow" class="sp-pill ${state.filters.tempo === 'Slow' ? 'active' : ''}" onclick="togglePlayerTempoPill('Slow')" style="${opts.tempoCounts['Slow'] > 0 ? '' : 'display:none;'}">🐢 Slow (${opts.tempoCounts['Slow'] || 0})</button>
        <button type="button" id="spPillTempoMid" class="sp-pill ${state.filters.tempo === 'Mid-tempo' ? 'active' : ''}" onclick="togglePlayerTempoPill('Mid-tempo')" style="${opts.tempoCounts['Mid-tempo'] > 0 ? '' : 'display:none;'}">🚶 Mid-tempo (${opts.tempoCounts['Mid-tempo'] || 0})</button>
        <button type="button" id="spPillTempoFast" class="sp-pill ${state.filters.tempo === 'Fast' ? 'active' : ''}" onclick="togglePlayerTempoPill('Fast')" style="${opts.tempoCounts['Fast'] > 0 ? '' : 'display:none;'}">⚡ Fast (${opts.tempoCounts['Fast'] || 0})</button>
        <button type="button" id="spPillTempoVFast" class="sp-pill ${state.filters.tempo === 'Very Fast' ? 'active' : ''}" onclick="togglePlayerTempoPill('Very Fast')" style="${opts.tempoCounts['Very Fast'] > 0 ? '' : 'display:none;'}">🔥 Very Fast (${opts.tempoCounts['Very Fast'] || 0})</button>
      </div>
    </div>
  `;
}

// In-place dropdown updater for smooth instant feedback in Player Mode
function updatePlayerFilterDropdowns() {
  const decadeSel = document.getElementById("spFilterDecade");
  const parentSel = document.getElementById("spFilterParentGenre");
  const genreSel = document.getElementById("spFilterGenre");
  const subSel = document.getElementById("spFilterSubGenre");
  const tempoSel = document.getElementById("spFilterTempo");
  if (!parentSel || !genreSel || !subSel) return;

  const opts = getPlayerFilterOptions();

  const tempoLabels = {
    "Slow": t("tempo_slow"),
    "Mid-tempo": t("tempo_mid"),
    "Fast": t("tempo_fast"),
    "Very Fast": t("tempo_vfast")
  };

  if (decadeSel) {
    decadeSel.innerHTML = `<option value="All">${t("filter_all_decades")} (${opts.totalBaseCount})</option>` +
      opts.availableDecades.map(d => `<option value="${escapeHtml(d)}" ${state.filters.decade === d ? 'selected' : ''}>${escapeHtml(d)} (${opts.decadeCounts[d] || 0})</option>`).join("");
    decadeSel.value = state.filters.decade || "All";
    decadeSel.classList.toggle("active-filter", state.filters.decade !== "All");
  }

  parentSel.innerHTML = `<option value="All">${t("filter_all_parents")} (${opts.tracksForParentsCount})</option>` +
    opts.availableParents.map(p => `<option value="${escapeHtml(p)}" ${state.filters.parent_genre === p ? 'selected' : ''}>${escapeHtml(p)} (${opts.parentCounts[p] || 0})</option>`).join("");
  parentSel.value = state.filters.parent_genre || "All";
  parentSel.classList.toggle("active-filter", state.filters.parent_genre !== "All");

  genreSel.innerHTML = `<option value="All">${t("filter_all_genres")} (${opts.tracksForGenresCount})</option>` +
    opts.availableGenres.map(g => `<option value="${escapeHtml(g)}" ${state.filters.genre === g ? 'selected' : ''}>${escapeHtml(g)} (${opts.genreCounts[g] || 0})</option>`).join("");
  genreSel.value = state.filters.genre || "All";
  genreSel.classList.toggle("active-filter", state.filters.genre !== "All");

  subSel.innerHTML = `<option value="All">${t("filter_all_subgenres")} (${opts.tracksForSubgenresCount})</option>` +
    opts.availableSubGenres.map(sg => `<option value="${escapeHtml(sg)}" ${state.filters.sub_genre === sg ? 'selected' : ''}>${escapeHtml(sg)} (${opts.subGenreCounts[sg] || 0})</option>`).join("");
  subSel.value = state.filters.sub_genre || "All";
  subSel.classList.toggle("active-filter", state.filters.sub_genre !== "All");

  if (tempoSel) {
    tempoSel.innerHTML = `<option value="All">${t("filter_all_tempos")} (${opts.tracksForTempoCount})</option>` +
      opts.availableTempos.map(tempoKey => `<option value="${tempoKey}" ${state.filters.tempo === tempoKey ? 'selected' : ''}>${escapeHtml(tempoLabels[tempoKey] || tempoKey)} (${opts.tempoCounts[tempoKey] || 0})</option>`).join("");
    tempoSel.value = state.filters.tempo || "All";
    tempoSel.classList.toggle("active-filter", state.filters.tempo !== "All");
  }

  // Quick pills sync
  const pillSlow = document.getElementById("spPillTempoSlow");
  const pillMid = document.getElementById("spPillTempoMid");
  const pillFast = document.getElementById("spPillTempoFast");
  const pillVFast = document.getElementById("spPillTempoVFast");
  if (pillSlow) {
    pillSlow.style.display = opts.tempoCounts["Slow"] > 0 ? "" : "none";
    pillSlow.classList.toggle("active", state.filters.tempo === "Slow");
    pillSlow.textContent = `🐢 Slow (${opts.tempoCounts["Slow"] || 0})`;
  }
  if (pillMid) {
    pillMid.style.display = opts.tempoCounts["Mid-tempo"] > 0 ? "" : "none";
    pillMid.classList.toggle("active", state.filters.tempo === "Mid-tempo");
    pillMid.textContent = `🚶 Mid-tempo (${opts.tempoCounts["Mid-tempo"] || 0})`;
  }
  if (pillFast) {
    pillFast.style.display = opts.tempoCounts["Fast"] > 0 ? "" : "none";
    pillFast.classList.toggle("active", state.filters.tempo === "Fast");
    pillFast.textContent = `⚡ Fast (${opts.tempoCounts["Fast"] || 0})`;
  }
  if (pillVFast) {
    pillVFast.style.display = opts.tempoCounts["Very Fast"] > 0 ? "" : "none";
    pillVFast.classList.toggle("active", state.filters.tempo === "Very Fast");
    pillVFast.textContent = `🔥 Very Fast (${opts.tempoCounts["Very Fast"] || 0})`;
  }

  // Update reset filter button in header
  let activeFilterCount = 0;
  if (state.filters.decade && state.filters.decade !== "All") activeFilterCount++;
  if (state.filters.parent_genre && state.filters.parent_genre !== "All") activeFilterCount++;
  if (state.filters.genre && state.filters.genre !== "All") activeFilterCount++;
  if (state.filters.sub_genre && state.filters.sub_genre !== "All") activeFilterCount++;
  if (state.filters.tempo && state.filters.tempo !== "All") activeFilterCount++;
  if (state.filters.is_liked && state.filters.is_liked !== "All") activeFilterCount++;

  const filterBar = document.getElementById("spFilterBar");
  if (filterBar) {
    const existingResetBtn = filterBar.querySelector(".sp-reset-filter-btn");
    const filterHeader = filterBar.querySelector(".sp-filter-bar-header");
    if (activeFilterCount > 0) {
      if (existingResetBtn) {
        const spanEl = existingResetBtn.querySelector("span");
        if (spanEl) spanEl.textContent = t("filter_active_n", { n: activeFilterCount });
      } else if (filterHeader) {
        const btnHtml = `
          <button type="button" class="sp-reset-filter-btn" onclick="resetAllPlayerFilters()" title="${t('filter_reset')}">
            <svg class="lucide" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span>${t("filter_active_n", { n: activeFilterCount })}</span>
          </button>
        `;
        filterHeader.insertAdjacentHTML("beforeend", btnHtml);
      }
    } else if (existingResetBtn) {
      existingResetBtn.remove();
    }
  }
}

window.handlePlayerFilterSelect = function(field, value) {
  if (state.appMode === "player" && state.playerView !== "all-tracks") {
    state.playerView = "all-tracks";
    updatePlayerNavActive();
  }

  state.filters[field] = value;

  // Immediate dynamic in-place update of dropdowns and options
  updatePlayerFilterDropdowns();

  if (genreFilter && state.filters.genre) genreFilter.value = state.filters.genre;
  if (subGenreFilter && state.filters.sub_genre) subGenreFilter.value = state.filters.sub_genre;

  fetchTracks();
};

window.togglePlayerTempoPill = function(tempoVal) {
  if (state.filters.tempo === tempoVal) {
    state.filters.tempo = "All";
  } else {
    state.filters.tempo = tempoVal;
  }
  updatePlayerFilterDropdowns();
  fetchTracks();
};

window.togglePlayerLikedPill = function() {
  if (state.filters.is_liked === "1") {
    state.filters.is_liked = "All";
  } else {
    state.filters.is_liked = "1";
  }
  updatePlayerFilterDropdowns();
  fetchTracks();
};

window.resetAllPlayerFilters = function() {
  state.filters.decade = "All";
  state.filters.parent_genre = "All";
  state.filters.genre = "All";
  state.filters.sub_genre = "All";
  state.filters.tempo = "All";
  state.filters.is_liked = "All";
  if (genreFilter) genreFilter.value = "All";
  if (subGenreFilter) subGenreFilter.value = "All";
  updatePlayerFilterDropdowns();
  fetchTracks();
  showToast(t("toast_filter_cleared") || "Filter berhasil dibersihkan", "info");
};

// 3. Artists Grid View
function renderArtistsGridView() {
  if (!spContentScroll) return;
  const artistMap = {};
  state.tracks.forEach(trk => {
    const a = trk.artist || "Unknown Artist";
    if (!artistMap[a]) {
      artistMap[a] = { artist: a, count: 0, sampleTrack: trk };
    }
    artistMap[a].count++;
  });
  const artists = Object.values(artistMap).sort((a, b) => b.count - a.count);

  spContentScroll.innerHTML = `
    <div class="sp-section-header">
      <h2 class="sp-hero-title">${t("pm_nav_artists")}</h2>
      <span class="sp-section-subtitle">${artists.length} artis teridentifikasi</span>
    </div>
    <div class="sp-card-grid">
      ${artists.map(art => `
        <div class="sp-card" onclick="openFilteredView('artist', '${escapeHtml(art.artist)}')">
          <div class="sp-card-art-wrap" style="border-radius:50%; overflow:hidden; background: #1a2233;">
            <div class="sp-card-art" style="border-radius:50%;">
              ${art.sampleTrack && art.sampleTrack.has_cover
                ? `<img src="${getTrackCoverUrl(art.sampleTrack.id, art.sampleTrack.cover_v)}" loading="lazy" decoding="async" style="border-radius:50%;" alt="">`
                : `<div style="font-size:32px; font-weight:700; color:var(--accent);">${escapeHtml(art.artist.charAt(0).toUpperCase())}</div>`}
            </div>
            <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('artist', '${escapeHtml(art.artist)}')" title="Putar Semua Lagu ${escapeHtml(art.artist)}">
              ${ICONS.play}
            </button>
          </div>
          <div class="sp-card-meta" style="text-align:center; align-items:center;">
            <span class="sp-card-title">${escapeHtml(art.artist)}</span>
            <span class="sp-card-sub">${art.count} lagu</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// 4. Albums Grid View
function renderAlbumsGridView() {
  if (!spContentScroll) return;
  const albumMap = {};
  state.tracks.forEach(trk => {
    const al = trk.album || "Unknown Album";
    if (!albumMap[al]) {
      albumMap[al] = { album: al, artist: trk.artist, count: 0, sampleTrack: trk };
    }
    albumMap[al].count++;
  });
  const albums = Object.values(albumMap).sort((a, b) => b.count - a.count);

  spContentScroll.innerHTML = `
    <div class="sp-section-header">
      <h2 class="sp-hero-title">${t("pm_nav_albums")}</h2>
      <span class="sp-section-subtitle">${albums.length} album</span>
    </div>
    <div class="sp-card-grid">
      ${albums.map(al => {
        const art = al.sampleTrack && al.sampleTrack.has_cover
          ? `<img src="${getTrackCoverUrl(al.sampleTrack.id, al.sampleTrack.cover_v)}" loading="lazy" decoding="async" alt="">`
          : ICONS.disc;
        return `
          <div class="sp-card" onclick="openFilteredView('album', '${escapeHtml(al.album)}')">
            <div class="sp-card-art-wrap">
              <div class="sp-card-art">${art}</div>
              <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('album', '${escapeHtml(al.album)}')" title="Putar Album">
                ${ICONS.play}
              </button>
            </div>
            <div class="sp-card-meta">
              <span class="sp-card-title">${escapeHtml(al.album)}</span>
              <span class="sp-card-sub">${escapeHtml(al.artist || "—")} • ${al.count} lagu</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// 5. Decades Grid View
function renderDecadesGridView() {
  if (!spContentScroll) return;
  const decades = (state.taxonomies.decades && state.taxonomies.decades.length > 0)
    ? state.taxonomies.decades
    : ["2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "1960s"];

  spContentScroll.innerHTML = `
    <div class="sp-section-header">
      <h2 class="sp-hero-title">${t("pm_nav_decades")}</h2>
      <span class="sp-section-subtitle">Jelajahi lagu berdasarkan era dekade rilis</span>
    </div>
    <div class="sp-card-grid">
      ${decades.map(dec => {
        const decCount = (state.taxonomies.decade_counts && state.taxonomies.decade_counts[dec]) ?? state.tracks.filter(tr => tr.decade === dec).length;
        return `
          <div class="sp-card" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), #141822);" onclick="openFilteredView('decade', '${dec}')">
            <div class="sp-card-art-wrap" style="background: radial-gradient(circle, rgba(245,158,11,0.25), #0b0f19); display:flex; align-items:center; justify-content:center;">
              <div style="font-size:28px; font-weight:800; color:var(--accent); letter-spacing:0.02em;">${dec}</div>
              <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('decade', '${dec}')" title="Putar Dekade ${dec}">
                ${ICONS.play}
              </button>
            </div>
            <div class="sp-card-meta">
              <span class="sp-card-title">${dec} Hits & Klasik</span>
              <span class="sp-card-sub">${decCount} lagu</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// 5b. Genres Grid View
function renderGenresGridView() {
  if (!spContentScroll) return;
  const parents = (state.taxonomies.parent_genres && state.taxonomies.parent_genres.length > 0)
    ? state.taxonomies.parent_genres
    : ["Blues", "Country", "EDM", "Electronic", "Folk", "Hip Hop", "Latin", "Metal", "Pop", "R&B", "Reggae", "Rock"];

  const genreGradients = {
    "EDM": "linear-gradient(135deg, rgba(236, 72, 153, 0.18), #141822)",
    "Electronic": "linear-gradient(135deg, rgba(168, 85, 247, 0.18), #141822)",
    "Rock": "linear-gradient(135deg, rgba(239, 68, 68, 0.18), #141822)",
    "Metal": "linear-gradient(135deg, rgba(220, 38, 38, 0.22), #0f131a)",
    "Pop": "linear-gradient(135deg, rgba(244, 114, 182, 0.18), #141822)",
    "Hip Hop": "linear-gradient(135deg, rgba(245, 158, 11, 0.18), #141822)",
    "R&B": "linear-gradient(135deg, rgba(99, 102, 241, 0.18), #141822)",
    "Jazz": "linear-gradient(135deg, rgba(16, 185, 129, 0.18), #141822)",
    "Blues": "linear-gradient(135deg, rgba(14, 165, 233, 0.18), #141822)",
    "Country": "linear-gradient(135deg, rgba(217, 119, 6, 0.18), #141822)",
    "Folk": "linear-gradient(135deg, rgba(132, 204, 22, 0.18), #141822)",
    "Latin": "linear-gradient(135deg, rgba(249, 115, 22, 0.18), #141822)",
    "Reggae": "linear-gradient(135deg, rgba(16, 185, 129, 0.18), #141822)"
  };

  spContentScroll.innerHTML = `
    <div class="sp-section-header">
      <h2 class="sp-hero-title">${t("pm_genres_title")}</h2>
      <span class="sp-section-subtitle">${t("pm_genres_subtitle")}</span>
    </div>
    <div class="sp-card-grid">
      ${parents.map(p => {
        const count = (state.taxonomies.parent_genre_counts && state.taxonomies.parent_genre_counts[p]) ?? state.tracks.filter(t => t.parent_genre === p).length;
        const bg = genreGradients[p] || "linear-gradient(135deg, rgba(245, 158, 11, 0.15), #141822)";
        return `
          <div class="sp-card" style="background: ${bg};" onclick="openFilteredView('parent_genre', '${escapeHtml(p)}')">
            <div class="sp-card-art-wrap" style="background: rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
              <div style="font-size:20px; font-weight:800; color:var(--text); text-align:center; padding:12px;">${escapeHtml(p)}</div>
              <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('parent_genre', '${escapeHtml(p)}')" title="Putar Genre ${escapeHtml(p)}">
                ${ICONS.play}
              </button>
            </div>
            <div class="sp-card-meta">
              <span class="sp-card-title">${escapeHtml(p)}</span>
              <span class="sp-card-sub">${count} lagu</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// 5c. Tempo / Pace Grid View
function renderTempoGridView() {
  if (!spContentScroll) return;

  const tempoCards = [
    {
      id: "Slow",
      title: "Slow & Chill",
      bpm: "~60 - 90 BPM",
      desc: "Balada, lofi, ambient, downtempo, akustik & musik santai",
      icon: "🐢",
      bg: "linear-gradient(135deg, rgba(56, 189, 248, 0.18), #111827)",
      accent: "#38bdf8"
    },
    {
      id: "Mid-tempo",
      title: "Mid-tempo Grooves",
      bpm: "~90 - 120 BPM",
      desc: "Pop, classic rock, funk, R&B, irama santai & ketukan seimbang",
      icon: "🚶",
      bg: "linear-gradient(135deg, rgba(52, 211, 153, 0.18), #111827)",
      accent: "#34d399"
    },
    {
      id: "Fast",
      title: "Upbeat & Fast",
      bpm: "~120 - 145 BPM",
      desc: "EDM, house, techno, dance-pop, hard rock & energi workout",
      icon: "⚡",
      bg: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), #111827)",
      accent: "#f59e0b"
    },
    {
      id: "Very Fast",
      title: "Very Fast & Intense",
      bpm: "145+ BPM",
      desc: "Metal, drum & bass, hardcore, adrenalin tinggi & ketukan maksimal",
      icon: "🔥",
      bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), #111827)",
      accent: "#f87171"
    }
  ];

  spContentScroll.innerHTML = `
    <div class="sp-section-header">
      <h2 class="sp-hero-title">${t("pm_tempo_title")}</h2>
      <span class="sp-section-subtitle">${t("pm_tempo_subtitle")}</span>
    </div>
    <div class="sp-card-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
      ${tempoCards.map(tc => {
        const count = (state.taxonomies.tempo_counts && state.taxonomies.tempo_counts[tc.id]) ?? state.tracks.filter(t => t.tempo && t.tempo.toLowerCase().includes(tc.id.toLowerCase())).length;
        return `
          <div class="sp-card" style="background: ${tc.bg}; border-color: rgba(255,255,255,0.06);" onclick="openFilteredView('tempo', '${tc.id}')">
            <div class="sp-card-art-wrap" style="background: rgba(0,0,0,0.35); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
              <span style="font-size:38px;">${tc.icon}</span>
              <span style="font-size:13px; font-weight:700; color:${tc.accent}; letter-spacing:0.02em;">${tc.bpm}</span>
              <button class="sp-card-play-btn" onclick="event.stopPropagation(); playFilteredList('tempo', '${tc.id}')" title="Putar Tempo ${tc.title}">
                ${ICONS.play}
              </button>
            </div>
            <div class="sp-card-meta">
              <span class="sp-card-title" style="color:var(--text); font-size:14px;">${tc.title}</span>
              <span class="sp-card-sub" style="font-size:11px; line-height:1.3; margin-top:2px;">${tc.desc}</span>
              <span class="sp-card-sub" style="color:${tc.accent}; font-weight:600; margin-top:4px;">${count} lagu</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// 6. Filtered View (Artist / Album / Decade / Genre / Tempo details)
async function renderFilteredTracksView(type, value) {
  if (!spContentScroll) return;
  let filteredTracks = [];
  let title = value;
  let typeLabel = "";
  let backView = "home";

  if (type === "artist") {
    typeLabel = "ARTIS";
    backView = "artists";
    filteredTracks = state.tracks.filter(t => (t.artist || "Unknown Artist") === value);
    if (filteredTracks.length === 0) {
      try {
        const res = await fetch(`/api/tracks?search=${encodeURIComponent(value)}`);
        if (res.ok) filteredTracks = await res.json();
      } catch (_) {}
    }
  } else if (type === "album") {
    typeLabel = "ALBUM";
    backView = "albums";
    filteredTracks = state.tracks.filter(t => (t.album || "Unknown Album") === value);
    if (filteredTracks.length === 0) {
      try {
        const res = await fetch(`/api/tracks?search=${encodeURIComponent(value)}`);
        if (res.ok) filteredTracks = await res.json();
      } catch (_) {}
    }
  } else if (type === "decade") {
    typeLabel = "DEKADE";
    backView = "decades";
    try {
      const res = await fetch(`/api/tracks?decade=${encodeURIComponent(value)}`);
      if (res.ok) filteredTracks = await res.json();
    } catch (_) {
      filteredTracks = state.tracks.filter(t => t.decade === value);
    }
  } else if (type === "parent_genre") {
    typeLabel = "PARENT GENRE";
    backView = "genres";
    try {
      const res = await fetch(`/api/tracks?parent_genre=${encodeURIComponent(value)}`);
      if (res.ok) filteredTracks = await res.json();
    } catch (_) {
      filteredTracks = state.tracks.filter(t => t.parent_genre === value);
    }
  } else if (type === "tempo") {
    typeLabel = "TEMPO & PACE";
    backView = "tempo";
    try {
      const res = await fetch(`/api/tracks?tempo=${encodeURIComponent(value)}`);
      if (res.ok) filteredTracks = await res.json();
    } catch (_) {
      filteredTracks = state.tracks.filter(t => t.tempo && t.tempo.toLowerCase().includes(value.toLowerCase()));
    }
  }

  const sample = filteredTracks.find(t => t.has_cover);
  const art = sample
    ? `<img src="${getTrackCoverUrl(sample.id, sample.cover_v)}" loading="lazy" decoding="async" alt="">`
    : `<div style="font-size:40px; font-weight:800; color:var(--accent);">${escapeHtml(title.charAt(0).toUpperCase())}</div>`;

  spContentScroll.innerHTML = `
    <button class="btn-text-dim" onclick="navigateToPlayerView('${backView}')" style="align-self:flex-start; display:flex; align-items:center; gap:6px; margin-bottom:-12px;">
      <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      <span>Kembali</span>
    </button>

    <div class="sp-detail-header">
      <div class="sp-detail-art">
        ${art}
      </div>
      <div class="sp-detail-info">
        <span class="sp-detail-type">${typeLabel}</span>
        <h1 class="sp-detail-title">${escapeHtml(title)}</h1>
        <div class="sp-detail-stats">
          <span>${filteredTracks.length} lagu</span>
          <span>•</span>
          <span>${formatTotalDuration(filteredTracks)}</span>
        </div>
      </div>
    </div>

    <div class="sp-detail-actions">
      <button class="sp-play-hero-btn" onclick="playSpecificTrackList(${JSON.stringify(filteredTracks.map(t => t.id))})" title="Putar Semua">
        ${ICONS.play}
      </button>
    </div>

    ${buildTracklistTableHtml(filteredTracks, false)}
  `;
}

// 7. Playlist Detail View
async function renderPlaylistDetailView(playlistId) {
  if (!spContentScroll) return;
  try {
    const res = await fetch(`/api/playlists/${playlistId}`);
    if (!res.ok) throw new Error("Playlist tidak ditemukan");
    const pl = await res.json();
    const tracks = pl.tracks || [];

    const sample = tracks.find(t => t.has_cover);
    const art = sample
      ? `<img src="${getTrackCoverUrl(sample.id, sample.cover_v)}" loading="lazy" decoding="async" alt="">`
      : `<svg class="lucide" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

    spContentScroll.innerHTML = `
      <div class="sp-detail-header">
        <div class="sp-detail-art" style="background: linear-gradient(135deg, rgba(245,158,11,0.2), #151d2a);">
          ${art}
        </div>
        <div class="sp-detail-info">
          <span class="sp-detail-type">PLAYLIST</span>
          <h1 class="sp-detail-title">${escapeHtml(pl.name)}</h1>
          ${pl.description ? `<p class="sp-detail-desc">${escapeHtml(pl.description)}</p>` : ""}
          <div class="sp-detail-stats">
            <span>${tracks.length} lagu</span>
            <span>•</span>
            <span>${formatTotalDuration(tracks)}</span>
          </div>
        </div>
      </div>

      <div class="sp-detail-actions">
        <button class="sp-play-hero-btn" onclick="playSpecificTrackList(${JSON.stringify(tracks.map(t => t.id))})" title="Putar Playlist">
          ${ICONS.play}
        </button>
        <button class="btn-secondary" onclick="exportPlaylistM3u(${pl.id})" style="display:flex; align-items:center; gap:8px;">
          <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span data-i18n="pm_export_m3u">${t("pm_export_m3u")}</span>
        </button>
        <button class="btn-icon" onclick="deletePlaylist(${pl.id})" title="Hapus Playlist" style="color:var(--text-3); margin-left:auto;">
          <svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>

      ${tracks.length === 0
        ? `<div style="padding:48px 0; text-align:center; color:var(--text-3); font-size:13px;">${t("pm_empty_playlist")}</div>`
        : buildTracklistTableHtml(tracks, true, pl.id)
      }
    `;
  } catch (err) {
    spContentScroll.innerHTML = `<div style="padding:24px; color:var(--danger);">${err.message}</div>`;
  }
}

const TRACKLIST_INITIAL_CHUNK = 80;
const TRACKLIST_CHUNK_STEP = 60;

function buildTrackRowHtml(track, idx) {
  const isPlaying = state.currentPlayingTrack && state.currentPlayingTrack.id === track.id && state.isPlaying;
  const art = track.has_cover
    ? `<img src="${getTrackCoverUrl(track.id, track.cover_v)}" loading="lazy" decoding="async" alt="">`
    : ICONS.disc;

  let tempoBadge = "";
  if (track.tempo) {
    const tLow = track.tempo.toLowerCase();
    let badgeClass = "sp-tempo-mid";
    let icon = "🚶";
    let filterVal = "Mid-tempo";
    if (tLow.includes("very fast")) {
      badgeClass = "sp-tempo-vfast";
      icon = "🔥";
      filterVal = "Very Fast";
    } else if (tLow.includes("fast")) {
      badgeClass = "sp-tempo-fast";
      icon = "⚡";
      filterVal = "Fast";
    } else if (tLow.includes("slow")) {
      badgeClass = "sp-tempo-slow";
      icon = "🐢";
      filterVal = "Slow";
    }
    tempoBadge = `<span class="sp-tempo-badge ${badgeClass}" onclick="event.stopPropagation(); togglePlayerTempoPill('${filterVal}')" title="${t('filter_tempo')}: ${filterVal}">${icon} ${escapeHtml(track.tempo)}</span>`;
  }

  const parentBadge = track.parent_genre
    ? `<span class="sp-genre-chip" onclick="event.stopPropagation(); handlePlayerFilterSelect('parent_genre', '${escapeHtml(track.parent_genre)}')" title="Filter: ${escapeHtml(track.parent_genre)}">${escapeHtml(track.parent_genre)}</span>`
    : "";

  const genreBadge = (track.genre && track.genre !== track.parent_genre)
    ? `<span class="sp-genre-chip" onclick="event.stopPropagation(); handlePlayerFilterSelect('genre', '${escapeHtml(track.genre)}')" title="Filter Genre: ${escapeHtml(track.genre)}">${escapeHtml(track.genre)}</span>`
    : "";

  const subBadge = (track.sub_genre && track.sub_genre !== track.genre && track.sub_genre !== track.parent_genre)
    ? `<span class="sp-genre-chip" onclick="event.stopPropagation(); handlePlayerFilterSelect('sub_genre', '${escapeHtml(track.sub_genre)}')" title="Filter Subgenre: ${escapeHtml(track.sub_genre)}">${escapeHtml(track.sub_genre)}</span>`
    : "";

  const isLiked = !!track.is_liked;

  return `
    <tr class="${isPlaying ? 'active-playing' : ''}" data-track-id="${track.id}" ondblclick="playTrackById(${track.id})" oncontextmenu="handleTrackContextMenu(event, ${track.id})">
      <td class="sp-track-idx">${isPlaying ? `<span style="color:var(--accent);">▶</span>` : (idx + 1)}</td>
      <td class="sp-track-art-cell">
        <div class="sp-track-thumb">
          ${art}
          <div class="sp-track-thumb-overlay">${ICONS.play}</div>
        </div>
      </td>
      <td class="sp-track-main-cell">
        <div class="sp-track-title" title="${escapeHtml(track.title || track.file_name)}">${escapeHtml(track.title || track.file_name)}</div>
        <div class="sp-track-artist" title="${escapeHtml(track.artist || '—')}">${escapeHtml(track.artist || "—")}${track.release_year ? ` • <span style="opacity:0.75;">${track.release_year}</span>` : ""}</div>
        ${(parentBadge || genreBadge || subBadge || tempoBadge) ? `
          <div class="sp-track-tags-cell">
            ${parentBadge}
            ${genreBadge}
            ${subBadge}
            ${tempoBadge}
          </div>
        ` : ""}
      </td>
      <td class="sp-track-album" title="${escapeHtml(track.album || '—')}">${escapeHtml(track.album || "—")}</td>
      <td class="sp-track-duration">${formatTime(track.duration || 0)}</td>
      <td class="sp-track-like-cell" onclick="event.stopPropagation();">
        <button class="sp-track-like-btn ${isLiked ? 'liked' : ''}" data-id="${track.id}" onclick="toggleTrackLike(${track.id}, event)" title="${isLiked ? t('unlike_song') : t('like_song')}">
          <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ef4444' : 'none'}" stroke="${isLiked ? '#ef4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </button>
      </td>
      <td class="sp-track-more-cell" onclick="event.stopPropagation();">
        <button class="sp-track-more-btn" onclick="handleTrackMoreClick(event, ${track.id})" title="${t('pm_track_options_tip')}">
          <svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

// Build table HTML for tracklists in Player Mode with progressive chunking
function buildTracklistTableHtml(tracks, isPlaylist = false, playlistId = null) {
  if (!tracks || tracks.length === 0) {
    window._activeTracklistData = null;
    return `<div style="padding:32px 0; color:var(--text-3); font-size:13px; text-align:center;">Tidak ada lagu.</div>`;
  }

  const initialSlice = tracks.slice(0, TRACKLIST_INITIAL_CHUNK);
  window._activeTracklistData = {
    tracks: tracks,
    renderedCount: initialSlice.length,
    isPlaylist: isPlaylist,
    playlistId: playlistId,
    isLoadingChunk: false
  };

  return `
    <table class="sp-tracklist">
      <thead>
        <tr>
          <th class="sp-col-idx">#</th>
          <th class="sp-col-art"></th>
          <th class="sp-col-title">JUDUL</th>
          <th class="sp-col-album">ALBUM</th>
          <th class="sp-col-duration">DURASI</th>
          <th class="sp-col-like"></th>
          <th class="sp-col-more"></th>
        </tr>
      </thead>
      <tbody id="spTracklistBody">
        ${initialSlice.map((track, idx) => buildTrackRowHtml(track, idx)).join("")}
      </tbody>
    </table>
    ${tracks.length > TRACKLIST_INITIAL_CHUNK ? `<div id="spTracklistSentinel" style="height: 24px;"></div>` : ""}
  `;
}

function appendNextTracklistChunk() {
  const data = window._activeTracklistData;
  if (!data || data.isLoadingChunk) return;
  if (data.renderedCount >= data.tracks.length) return;

  const tbody = document.getElementById("spTracklistBody") || (spContentScroll ? spContentScroll.querySelector(".sp-tracklist tbody") : null);
  if (!tbody) return;

  data.isLoadingChunk = true;
  const nextSlice = data.tracks.slice(data.renderedCount, data.renderedCount + TRACKLIST_CHUNK_STEP);
  const startIdx = data.renderedCount;
  data.renderedCount += nextSlice.length;

  const chunkHtml = nextSlice.map((track, i) => buildTrackRowHtml(track, startIdx + i)).join("");
  tbody.insertAdjacentHTML("beforeend", chunkHtml);

  data.isLoadingChunk = false;

  if (data.renderedCount >= data.tracks.length) {
    const sentinel = document.getElementById("spTracklistSentinel");
    if (sentinel) sentinel.remove();
  }
}
window.appendNextTracklistChunk = appendNextTracklistChunk;

function handleTrackContextMenu(e, trackId) {
  e.preventDefault();
  e.stopPropagation();
  const track = state.tracks.find(t => t.id === trackId);
  if (track) {
    openContextMenu(track, e.clientX, e.clientY);
  }
}
window.handleTrackContextMenu = handleTrackContextMenu;

function handleTrackMoreClick(e, trackId) {
  e.stopPropagation();
  const track = state.tracks.find(t => t.id === trackId);
  if (track) {
    openContextMenu(track, e.clientX, e.clientY);
  }
}
window.handleTrackMoreClick = handleTrackMoreClick;

function playTrackById(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (track) playTrack(track);
}
window.playTrackById = playTrackById;

function playAllCurrentList() {
  if (state.tracks.length > 0) {
    playTrack(state.tracks[0]);
  }
}
window.playAllCurrentList = playAllCurrentList;

function shuffleAllCurrentList() {
  if (state.tracks.length === 0) return;
  state.isShuffle = true;
  if (playerShuffleToggleBtn) playerShuffleToggleBtn.classList.add("active");
  const r = Math.floor(Math.random() * state.tracks.length);
  playTrack(state.tracks[r]);
}
window.shuffleAllCurrentList = shuffleAllCurrentList;

function playSpecificTrackList(trackIds) {
  if (!trackIds || trackIds.length === 0) return;
  const first = state.tracks.find(t => t.id === trackIds[0]);
  if (first) playTrack(first);
}
window.playSpecificTrackList = playSpecificTrackList;

function shuffleSpecificTrackList(trackIds) {
  if (!trackIds || trackIds.length === 0) return;
  state.isShuffle = true;
  if (playerShuffleToggleBtn) playerShuffleToggleBtn.classList.add("active");
  const r = Math.floor(Math.random() * trackIds.length);
  const picked = state.tracks.find(t => t.id === trackIds[r]);
  if (picked) playTrack(picked);
}
window.shuffleSpecificTrackList = shuffleSpecificTrackList;

function playFilteredList(type, value) {
  let list = [];
  if (type === "artist") list = state.tracks.filter(t => (t.artist || "Unknown Artist") === value);
  else if (type === "album") list = state.tracks.filter(t => (t.album || "Unknown Album") === value);
  else if (type === "decade") list = state.tracks.filter(t => t.decade === value);
  else if (type === "parent_genre") list = state.tracks.filter(t => t.parent_genre === value);
  else if (type === "tempo") list = state.tracks.filter(t => t.tempo && t.tempo.toLowerCase().includes(value.toLowerCase()));
  if (list.length > 0) playTrack(list[0]);
}
window.playFilteredList = playFilteredList;

function openFilteredView(type, value) {
  state.playerView = `${type}-tracks`;
  state.activeFilterValue = value;
  renderFilteredTracksView(type, value);
}
window.openFilteredView = openFilteredView;

function navigateToPlayerView(view) {
  state.playerView = view;
  state.activePlaylistId = null;
  state.activeFilterValue = null;
  updatePlayerNavActive();
  renderPlayerView(true);
}
window.navigateToPlayerView = navigateToPlayerView;

function updatePlayerPlayingStateUI() {
  if (!spContentScroll) return;
  spContentScroll.querySelectorAll("tr[data-track-id]").forEach(row => {
    const id = parseInt(row.dataset.trackId);
    const isPlaying = state.currentPlayingTrack && state.currentPlayingTrack.id === id && state.isPlaying;
    row.classList.toggle("active-playing", isPlaying);
    const idxCell = row.querySelector(".sp-track-idx");
    if (idxCell && isPlaying) {
      idxCell.innerHTML = `<span style="color:var(--accent);">▶</span>`;
    }
  });
}

function formatTotalDuration(tracks) {
  const totalSec = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const m = Math.floor(totalSec / 60);
  if (m > 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h} jam ${remM} mnt`;
  }
  return `${m} menit`;
}

// --- Toggle Track Like Functionality ---
window.toggleTrackLike = async function(trackId, e) {
  if (e) e.stopPropagation();
  const track = state.tracks.find(t => t.id === trackId);
  const oldVal = track ? (track.is_liked || 0) : 0;
  const newVal = oldVal ? 0 : 1;

  // Optimistic UI updates
  if (track) track.is_liked = newVal;
  const trackMaster = (state.allTracks || []).find(t => t.id === trackId);
  if (trackMaster) trackMaster.is_liked = newVal;
  if (state.currentPlayingTrack && state.currentPlayingTrack.id === trackId) {
    state.currentPlayingTrack.is_liked = newVal;
    updatePlayerLikeBtnUI(state.currentPlayingTrack);
  }

  // Update like buttons across the DOM
  document.querySelectorAll(`.sp-track-like-btn[data-id="${trackId}"]`).forEach(btn => {
    btn.classList.toggle("liked", newVal === 1);
    btn.title = newVal === 1 ? t("unlike_song") : t("like_song");
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.setAttribute("fill", newVal === 1 ? "#ef4444" : "none");
      svg.setAttribute("stroke", newVal === 1 ? "#ef4444" : "currentColor");
    }
  });

  try {
    const res = await fetch(`/api/track/${trackId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_liked: newVal })
    });
    if (res.ok) {
      const data = await res.json();
      if (track) track.is_liked = data.is_liked;
      if (trackMaster) trackMaster.is_liked = data.is_liked;
      showToast(newVal === 1 ? t("toast_track_liked") : t("toast_track_unliked"), "info");
      fetchTaxonomies();
      if (state.playerView === "liked") {
        renderLikedTracksView();
      }
    } else {
      if (track) track.is_liked = oldVal;
      if (trackMaster) trackMaster.is_liked = oldVal;
    }
  } catch (err) {
    console.error("Failed to toggle track like:", err);
    if (track) track.is_liked = oldVal;
    if (trackMaster) trackMaster.is_liked = oldVal;
  }
};

// --- Liked Tracks Detail View ---
function renderLikedTracksView() {
  if (!spContentScroll) return;
  const likedTracks = (state.allTracks && state.allTracks.length > 0 ? state.allTracks : state.tracks).filter(t => t.is_liked == 1);

  spContentScroll.innerHTML = `
    <div class="sp-detail-header">
      <div class="sp-detail-art liked-art">
        <svg class="heart-icon" width="64" height="64" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
      <div class="sp-detail-info">
        <span class="sp-detail-type">PLAYLIST</span>
        <h1 class="sp-detail-title" data-i18n="pm_liked_title">${t("pm_liked_title")}</h1>
        <p class="sp-detail-desc" data-i18n="pm_liked_subtitle">${t("pm_liked_subtitle")}</p>
        <div class="sp-detail-stats">
          <span>${t("pm_tracks_count", { n: likedTracks.length })}</span>
          <span>•</span>
          <span>${formatTotalDuration(likedTracks)}</span>
        </div>
      </div>
    </div>

    <div class="sp-detail-actions">
      <button class="sp-play-hero-btn" onclick="playSpecificTrackList(${JSON.stringify(likedTracks.map(t => t.id))})" title="${t('play_all_tip')}" ${likedTracks.length === 0 ? 'disabled style="opacity:0.4; pointer-events:none;"' : ''}>
        ${ICONS.play}
      </button>
      <button class="btn-secondary" onclick="shuffleSpecificTrackList(${JSON.stringify(likedTracks.map(t => t.id))})" style="display:flex; align-items:center; gap:8px;" ${likedTracks.length === 0 ? 'disabled style="opacity:0.4; pointer-events:none;"' : ''}>
        <svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.4c1.3 0 2.5.6 3.3 1.7l6.1 8.6c.8 1.1 2 1.7 3.3 1.7H22"/><path d="m18 22 4-4-4-4"/>
        </svg>
        <span data-i18n="shuffle_tip">${t("shuffle_tip")}</span>
      </button>
    </div>

    ${likedTracks.length === 0
      ? `<div style="padding:48px 0; text-align:center; color:var(--text-3); font-size:13px;" data-i18n="pm_liked_empty">${t("pm_liked_empty")}</div>`
      : buildTracklistTableHtml(likedTracks)
    }
  `;
}
window.renderLikedTracksView = renderLikedTracksView;

