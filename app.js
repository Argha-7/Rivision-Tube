/**
 * RivisionTube - Core Application Logic with Firebase Cloud Sync
 * Feature-rich YouTube Lecture Timestamp & Auto-Stop Clip Revision Hub
 */

// ==========================================
// 1. Application State & Storage
// ==========================================

const STORAGE_KEYS = {
  CLIPS: 'rivision_tube_clips_v2',
  SUBJECTS: 'rivision_tube_subjects_v2',
  CHAPTERS: 'rivision_tube_chapters_v2',
  CURRENT_VIDEO: 'rivision_tube_current_video_v2',
  SKIP_ZONES: 'rivision_tube_skip_zones_v2',
  FIREBASE_CONFIG: 'rivision_firebase_config_v2',
  FIREBASE_USER_ID: 'rivision_firebase_userid_v2'
};

// Initial Sample Demo Data (Guaranteed embeddable educational video)
const SAMPLE_DEMO_DATA = {
  clips: [
    {
      id: 'demo-clip-1',
      videoId: 'M7lc1UVf-VE', // YouTube's official 100% embed-allowed test video
      videoTitle: 'Physics Class 12: Electrostatics - Gauss Law & Symmetric Flux',
      videoUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      startTime: '00:00:10',
      startSeconds: 10,
      endTime: '00:00:35',
      endSeconds: 35,
      subject: 'Physics',
      chapter: 'Electrostatics',
      title: 'Q4: Gauss Law Flux for Outside Charge',
      tag: 'Tricky Question',
      note: 'Key Rule: If the charge is outside the closed Gaussian surface, the total incoming flux equals outgoing flux, so net flux is ZERO.',
      mastered: false,
      createdAt: Date.now() - 3600000 * 24
    },
    {
      id: 'demo-clip-2',
      videoId: 'M7lc1UVf-VE',
      videoTitle: 'Organic Chemistry: GOC - Stability of Carbocations',
      videoUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      startTime: '00:00:40',
      startSeconds: 40,
      endTime: '00:01:10',
      endSeconds: 70,
      subject: 'Chemistry',
      chapter: 'General Organic Chemistry',
      title: 'Carbocation Stability Priority Order',
      tag: 'Teacher\'s Secret Trick',
      note: 'Trick: Aromatic > Resonance > Hyperconjugation > Inductive effect (A > R > H > I rule). Always check for ring expansion!',
      mastered: true,
      createdAt: Date.now() - 3600000 * 12
    },
    {
      id: 'demo-clip-3',
      videoId: 'M7lc1UVf-VE',
      videoTitle: 'Mathematics: Calculus - Limits 0/0 Form Shortcuts',
      videoUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      startTime: '00:01:15',
      startSeconds: 75,
      endTime: '00:01:50',
      endSeconds: 110,
      subject: 'Mathematics',
      chapter: 'Calculus & Limits',
      title: 'L\'Hospital vs Expansion Shortcut in 0/0 Form',
      tag: 'Formula & Derivation',
      note: 'When dealing with trigonometric terms like sin(x) - tan(x), using Taylor series expansion is 3x faster than multiple L\'Hospital derivatives.',
      mastered: false,
      createdAt: Date.now() - 3600000 * 2
    }
  ],
  subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
  chapters: {
    'Physics': ['Electrostatics', 'Current Electricity', 'Ray Optics', 'Modern Physics', 'Thermodynamics'],
    'Chemistry': ['General Organic Chemistry', 'Chemical Bonding', 'Electrochemistry', 'Coordination Compounds'],
    'Mathematics': ['Calculus & Limits', 'Integration', 'Matrices & Determinants', '3D Geometry', 'Vectors'],
    'Biology': ['Cell Biology', 'Genetics & Evolution', 'Human Physiology'],
    'Computer Science': ['Data Structures', 'Algorithms', 'Web Development', 'DBMS']
  }
};

// Firebase Project Configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBmgSWEr12Gy8Ot2RRE_xroKbJPc8EVvXs",
  authDomain: "my-rivision-app.firebaseapp.com",
  projectId: "my-rivision-app",
  storageBucket: "my-rivision-app.firebasestorage.app",
  messagingSenderId: "561702279510",
  appId: "1:561702279510:web:85c0cd5e84c74e48529ef7",
  measurementId: "G-SX8E6VHLNP"
};

// Multi-Tier AI Services Configuration
const DEFAULT_GEMINI_API_KEY = "AIzaSyCJMXtURF6hI4o7jsDE1s8amZ6YWVZnsxs";
const DEFAULT_TRANSCRIPT_API_KEY = "sk_ONWiUzoql4Jelc8U31dB48ixTXU04El3kUsYb0ndCaM";
const DEFAULT_GROQ_API_KEY = "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";

let appState = {
  clips: [],
  subjects: [],
  chapters: {},
  skipZones: [], // Array of { id, videoId, startSeconds, endSeconds, label }
  activeRecordingSkipStart: null, // null or number (seconds)
  currentVideoId: null,
  currentVideoTitle: '',
  activeFilterSubject: 'all',
  activeFilterChapter: 'all',
  activeFilterTag: 'all',
  activeFilterDueToday: false,
  searchQuery: '',
  activePlayingClip: null, // { clipId, endSeconds, title }
  firebaseConfig: DEFAULT_FIREBASE_CONFIG,
  firebaseUserId: 'my_study_vault',
  isCloudConnected: false,
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  transcriptApiKey: DEFAULT_TRANSCRIPT_API_KEY,
  groqApiKey: DEFAULT_GROQ_API_KEY,
  transcriptCache: {}
};

// YouTube & Firebase Instances
let ytPlayer = null;
let ytPlayerReady = false;
let timeUpdateInterval = null;
let db = null;
let firestoreUnsubscribe = null;

// ==========================================
// 2. Initialization & State Management
// ==========================================

function initApp() {
  loadStateFromStorage();
  setupEventListeners();
  initFirebase();
  renderSubjectDropdowns();
  renderChapterDropdowns();
  renderSubjectFilterTabs();
  renderLibrary();
  updateHeaderStats();

  if (appState.currentVideoId) {
    document.getElementById('youtubeUrlInput').value = `https://www.youtube.com/watch?v=${appState.currentVideoId}`;
    loadYouTubeVideo(appState.currentVideoId, appState.currentVideoTitle);
  } else {
    const titleDisplay = document.getElementById('currentLectureTitle');
    if (titleDisplay) titleDisplay.textContent = 'Paste a YouTube lecture link above to start studying 📺';
  }
}

function loadStateFromStorage() {
  const savedClips = localStorage.getItem(STORAGE_KEYS.CLIPS);
  const savedSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
  const savedChapters = localStorage.getItem(STORAGE_KEYS.CHAPTERS);
  const savedCurrentVideo = localStorage.getItem(STORAGE_KEYS.CURRENT_VIDEO);
  const savedSkipZones = localStorage.getItem(STORAGE_KEYS.SKIP_ZONES);
  const savedFirebaseConfig = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
  const savedUserId = localStorage.getItem(STORAGE_KEYS.FIREBASE_USER_ID);

  if (savedFirebaseConfig) {
    try {
      appState.firebaseConfig = JSON.parse(savedFirebaseConfig);
    } catch(e){
      appState.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    }
  } else {
    appState.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
  }
  
  if (savedUserId) {
    appState.firebaseUserId = savedUserId;
  } else {
    appState.firebaseUserId = 'my_study_vault';
  }

  if (savedSkipZones) {
    try {
      appState.skipZones = JSON.parse(savedSkipZones) || [];
    } catch(e) {
      appState.skipZones = [];
    }
  }

  const defaultSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'];
  const defaultChapters = {
    'Physics': ['Electrostatics', 'Current Electricity', 'Ray Optics', 'Thermodynamics'],
    'Chemistry': ['General Organic Chemistry', 'Coordination Compounds', 'Chemical Kinetics'],
    'Mathematics': ['Calculus & Limits', 'Definite Integrals', 'Matrices & Determinants'],
    'Biology': ['Genetics & Evolution', 'Cell Biology', 'Human Physiology'],
    'Computer Science': ['Data Structures', 'Algorithms', 'Web Development']
  };

  if (savedClips) {
    try {
      appState.clips = JSON.parse(savedClips);
      appState.subjects = JSON.parse(savedSubjects) || defaultSubjects;
      appState.chapters = JSON.parse(savedChapters) || defaultChapters;
      appState.currentVideoId = savedCurrentVideo || (appState.clips[0] ? appState.clips[0].videoId : null);
    } catch (e) {
      console.error("Error loading storage:", e);
      appState.clips = [];
      appState.subjects = defaultSubjects;
      appState.chapters = defaultChapters;
      appState.currentVideoId = null;
    }
  } else {
    // Start clean with standard subject buckets
    appState.clips = [];
    appState.subjects = defaultSubjects;
    appState.chapters = defaultChapters;
    appState.currentVideoId = null;
    appState.currentVideoTitle = 'No Lecture Loaded';
  }
}

function saveStateToStorage(syncCloud = true) {
  localStorage.setItem(STORAGE_KEYS.CLIPS, JSON.stringify(appState.clips));
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(appState.subjects));
  localStorage.setItem(STORAGE_KEYS.CHAPTERS, JSON.stringify(appState.chapters));
  localStorage.setItem(STORAGE_KEYS.SKIP_ZONES, JSON.stringify(appState.skipZones || []));
  if (appState.currentVideoId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_VIDEO, appState.currentVideoId);
  }
  updateHeaderStats();

  if (syncCloud && appState.isCloudConnected && db) {
    pushStateToFirestore();
  }
}

function loadSampleData(showToastAlert = true) {
  appState.clips = [...SAMPLE_DEMO_DATA.clips];
  appState.subjects = [...SAMPLE_DEMO_DATA.subjects];
  appState.chapters = JSON.parse(JSON.stringify(SAMPLE_DEMO_DATA.chapters));
  appState.currentVideoId = 'M7lc1UVf-VE';
  appState.currentVideoTitle = 'Physics & Science Revision Class (Lecture Demo)';
  appState.skipZones = [
    {
      id: 'demo-skip-1',
      videoId: 'M7lc1UVf-VE',
      startSeconds: 20,
      startTime: '00:00:20',
      endSeconds: 30,
      endTime: '00:00:30',
      label: 'Teacher Chit-Chat / Intro Filler'
    }
  ];
  
  saveStateToStorage(true);
  renderSubjectDropdowns();
  renderChapterDropdowns();
  renderSubjectFilterTabs();
  renderLibrary();
  renderSkipZones();
  
  loadYouTubeVideo(appState.currentVideoId, appState.currentVideoTitle);
  
  if (showToastAlert) {
    showToast('✨ Demo clips loaded! Try clicking "▶ Play Clip" to test.', 'success');
  }
}

// ==========================================
// 3. Firebase Cloud Firestore Integration
// ==========================================

function initFirebase() {
  const cloudDot = document.getElementById('cloudDot');
  const cloudStatusText = document.getElementById('cloudStatusText');

  if (!appState.firebaseConfig || !window.firebase) {
    appState.isCloudConnected = false;
    if (cloudDot) cloudDot.className = 'cloud-dot';
    if (cloudStatusText) cloudStatusText.textContent = 'Local Mode';
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(appState.firebaseConfig);
    }
    db = firebase.firestore();
    appState.isCloudConnected = true;

    if (cloudDot) cloudDot.className = 'cloud-dot connected';
    if (cloudStatusText) cloudStatusText.textContent = `Cloud: ${appState.firebaseUserId}`;

    attachFirestoreRealtimeListener();
    showToast(`☁️ Connected to Firebase Cloud (${appState.firebaseUserId})`, 'success');
  } catch (err) {
    console.error("Firebase init error:", err);
    appState.isCloudConnected = false;
    if (cloudDot) cloudDot.className = 'cloud-dot';
    if (cloudStatusText) cloudStatusText.textContent = 'Firebase Error';
    showToast('Firebase connection failed. Check your config.', 'error');
  }
}

function attachFirestoreRealtimeListener() {
  if (!db || !appState.isCloudConnected) return;

  const docRef = db.collection('revision_users').doc(appState.firebaseUserId);

  if (firestoreUnsubscribe) firestoreUnsubscribe();

  firestoreUnsubscribe = docRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data && Array.isArray(data.clips)) {
        appState.clips = data.clips;
        if (Array.isArray(data.subjects)) appState.subjects = data.subjects;
        if (data.chapters) appState.chapters = data.chapters;
        if (Array.isArray(data.skipZones)) appState.skipZones = data.skipZones;

        // Save locally without re-pushing to cloud
        saveStateToStorage(false);
        renderSubjectDropdowns();
        renderChapterDropdowns();
        renderSubjectFilterTabs();
        renderLibrary();
        renderSkipZones();
      }
    } else {
      // First time user doc in cloud -> push current state
      pushStateToFirestore();
    }
  }, (error) => {
    console.error("Firestore sync error:", error);
    if (error.code === 'permission-denied') {
      showToast('⚠️ Firestore rules locked. Go to Firebase Console > Firestore > Rules and enable Test Mode (allow read, write: if true;).', 'error');
    }
  });
}

function pushStateToFirestore() {
  if (!db || !appState.isCloudConnected) return;

  const docRef = db.collection('revision_users').doc(appState.firebaseUserId);
  docRef.set({
    clips: appState.clips,
    subjects: appState.subjects,
    chapters: appState.chapters,
    skipZones: appState.skipZones || [],
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => {
    console.error("Error saving to Firestore:", err);
    if (err.code === 'permission-denied') {
      showToast('⚠️ Firestore locked: Enable Test Mode in Firebase Console > Firestore > Rules.', 'error');
    }
  });
}

function disconnectFirebase() {
  if (firestoreUnsubscribe) firestoreUnsubscribe();
  appState.firebaseConfig = null;
  appState.isCloudConnected = false;
  localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);

  const cloudDot = document.getElementById('cloudDot');
  const cloudStatusText = document.getElementById('cloudStatusText');
  if (cloudDot) cloudDot.className = 'cloud-dot';
  if (cloudStatusText) cloudStatusText.textContent = 'Local Mode';

  showToast('Disconnected from Firebase Cloud. Now in Local Mode.', 'info');
}

// ==========================================
// 4. YouTube IFrame API Integration
// ==========================================

window.onYouTubeIframeAPIReady = function() {
  ytPlayerReady = true;
  if (appState.currentVideoId) {
    createYouTubePlayer(appState.currentVideoId, false, 0);
  }
};

function createYouTubePlayer(videoId, autoPlay = true, startSeconds = 0) {
  const container = document.getElementById('youtubePlayerContainer');
  const placeholder = document.getElementById('playerPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  if (!container) return;

  if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    try {
      if (autoPlay) {
        ytPlayer.loadVideoById({ videoId: videoId, startSeconds: startSeconds });
      } else {
        ytPlayer.cueVideoById({ videoId: videoId, startSeconds: startSeconds });
      }
      updatePlayerStatus('Playing');
      return;
    } catch(e) {
      console.warn("Re-creating player...", e);
      ytPlayer = null;
    }
  }

  container.innerHTML = '<div id="yt-player-iframe"></div>';
  
  const playerVars = {
    autoplay: autoPlay ? 1 : 0,
    start: startSeconds,
    modestbranding: 1,
    rel: 0,
    enablejsapi: 1,
    playsinline: 1
  };

  // Only pass origin if on http/https protocol
  if (window.location.protocol.startsWith('http')) {
    playerVars.origin = window.location.origin;
  }

  try {
    ytPlayer = new YT.Player('yt-player-iframe', {
      videoId: videoId,
      host: 'https://www.youtube.com',
      playerVars: playerVars,
      events: {
        onReady: (event) => {
          updatePlayerStatus('Ready');
          startTimeTracking();
          if (autoPlay) {
            try { event.target.playVideo(); } catch (err) {}
          }
        },
        onStateChange: (event) => {
          handlePlayerStateChange(event);
        },
        onError: (event) => {
          handlePlayerError(event, videoId, startSeconds);
        }
      }
    });
  } catch (err) {
    console.error("YT.Player construction error:", err);
  }

  startTimeTracking();
}

function handlePlayerError(event, videoId, startSeconds) {
  console.warn("YouTube Player Error Code:", event.data);
  const errorMsg = (event.data === 101 || event.data === 150)
    ? "The creator of this specific video has disabled embedding on third-party sites."
    : (event.data === 2 || event.data === 100)
    ? "Invalid video ID or video has been removed."
    : "Error loading video.";

  showToast(`⚠️ ${errorMsg}`, 'error');
  updatePlayerStatus('Embed Restricted');
}

function handlePlayerStateChange(event) {
  const playPauseIcon = document.getElementById('playPauseIcon');
  if (event.data === YT.PlayerState.PLAYING) {
    updatePlayerStatus('Playing');
    if (playPauseIcon) playPauseIcon.textContent = '⏸';
  } else if (event.data === YT.PlayerState.PAUSED) {
    updatePlayerStatus('Paused');
    if (playPauseIcon) playPauseIcon.textContent = '▶';
  } else if (event.data === YT.PlayerState.ENDED) {
    updatePlayerStatus('Ended');
    if (playPauseIcon) playPauseIcon.textContent = '▶';
    if (appState.activePlayingClip) {
      triggerClipCompletion();
    }
  } else if (event.data === YT.PlayerState.BUFFERING) {
    updatePlayerStatus('Buffering');
  }
}

function updatePlayerStatus(text) {
  const badge = document.getElementById('playerStatusBadge');
  if (badge) {
    badge.textContent = text;
    badge.className = 'badge ' + (text === 'Playing' ? 'badge-pulse' : '');
  }
}

function startTimeTracking() {
  if (timeUpdateInterval) clearInterval(timeUpdateInterval);

  timeUpdateInterval = setInterval(() => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;

    try {
      const currentSeconds = ytPlayer.getCurrentTime() || 0;
      const formatted = formatSecondsToTime(Math.floor(currentSeconds));
      
      const liveTimeElem = document.getElementById('liveCurrentTime');
      if (liveTimeElem) liveTimeElem.textContent = formatted;

      const fsLiveTimeElem = document.getElementById('fsLiveTime');
      if (fsLiveTimeElem) fsLiveTimeElem.textContent = formatted;

      // AUTO-STOP LOGIC: Check if active clip reached end timestamp
      if (appState.activePlayingClip && appState.activePlayingClip.endSeconds) {
        if (currentSeconds >= (appState.activePlayingClip.endSeconds - 0.25)) {
          ytPlayer.pauseVideo();
          triggerClipCompletion();
        }
      }

      // AUTO-SKIP ZONES: Automatically teleport over marked filler sections
      if (appState.currentVideoId && appState.skipZones && appState.skipZones.length > 0) {
        const activeSkip = appState.skipZones.find(z => 
          z.videoId === appState.currentVideoId &&
          currentSeconds >= z.startSeconds && 
          currentSeconds < (z.endSeconds - 0.3)
        );
        if (activeSkip) {
          ytPlayer.seekTo(activeSkip.endSeconds, true);
          showToast(`⏭️ Auto-Skipped ${formatDurationDiff(activeSkip.startSeconds, activeSkip.endSeconds)} Teacher Chit-Chat!`, 'info');
        }
      }
    } catch (err) {}
  }, 250);
}

function triggerClipCompletion() {
  const overlay = document.getElementById('clipCompleteOverlay');
  const titleElem = document.getElementById('completedClipTitle');
  const metaElem = document.getElementById('completedClipMeta');
  const imgContainer = document.getElementById('completedVisualImgContainer');
  const visualImg = document.getElementById('completedClipVisualImg');
  const notesBox = document.getElementById('completedFlashcardNotes');
  const noteContent = document.getElementById('completedNoteContent');
  const revealBtn = document.getElementById('revealFormulaBtn');
  const revealBtnText = document.getElementById('revealFormulaBtnText');
  const listenBtn = document.getElementById('listenFlashcardNoteBtn');
  
  if (appState.activePlayingClip) {
    const clip = appState.clips.find(c => c.id === appState.activePlayingClip.clipId);
    if (clip) {
      if (titleElem) titleElem.textContent = clip.title || 'Concept Finished';
      if (metaElem) metaElem.textContent = `${clip.subject || 'General'} • ${clip.chapter || 'Topic'} (${clip.tag || 'Concept'})`;

      // Show AI Visual Concept Art on Flashcard (Always show topic-relevant 3D illustration)
      if (visualImg && imgContainer) {
        const topicImageUrl = clip.aiVisualUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent('accurate 3D educational concept illustration of ' + (clip.title || 'Science') + ', ' + (clip.subject || 'Physics') + ', textbook diagram')}?width=800&height=440&nologo=true`;
        visualImg.src = topicImageUrl;
        imgContainer.style.display = 'block';
      }

      // Prepare Secret Formulas & Notes with ChatGPT-style rich boxes
      if (noteContent && notesBox) {
        noteContent.innerHTML = formatAiNotesToChatGPTCards(clip.note || 'Mastered concept! No extra formulas attached.', '');
        notesBox.style.display = 'none'; // Initially hidden for active recall
      }

      if (revealBtn && revealBtnText) {
        revealBtnText.textContent = "Tap to Reveal Teacher's Formulas & Trick 💡";
        revealBtn.onclick = () => {
          const isHidden = notesBox.style.display === 'none';
          notesBox.style.display = isHidden ? 'block' : 'none';
          revealBtnText.textContent = isHidden ? "🔼 Hide Formulas & Notes" : "Tap to Reveal Teacher's Formulas & Trick 💡";
        };
      }

      if (listenBtn) {
        listenBtn.onclick = () => {
          if (clip.note) readOutNoteWithTTS(clip.note);
        };
      }
    }
  }
  
  if (overlay) overlay.classList.add('active');
}

function dismissClipOverlay() {
  const overlay = document.getElementById('clipCompleteOverlay');
  if (overlay) overlay.classList.remove('active');
  appState.activePlayingClip = null;
}

// ==========================================
// 5. Helpers (URLs & Timestamps)
// ==========================================

function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  url = url.trim();

  // 1. Direct 11 char ID check
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  // 2. Comprehensive RegEx matching all YouTube formats
  const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const match = url.match(regExp);
  if (match && match[1]) {
    return match[1];
  }

  // 3. URL object parser fallback
  try {
    const formattedUrl = (url.startsWith('http://') || url.startsWith('https://')) ? url : 'https://' + url;
    const parsed = new URL(formattedUrl);
    const host = parsed.hostname.toLowerCase().replace('www.', '').replace('m.', '');

    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v && v.length >= 11) return v.substring(0, 11);

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        return parts[1].substring(0, 11);
      }
    } else if (host === 'youtu.be') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) return parts[0].substring(0, 11);
    }
  } catch (err) {}

  return null;
}

function formatSecondsToTime(totalSeconds) {
  const secNum = parseInt(totalSeconds, 10) || 0;
  const hours = Math.floor(secNum / 3600);
  const minutes = Math.floor((secNum % 3600) / 60);
  const seconds = secNum % 60;

  const hStr = hours < 10 ? '0' + hours : hours;
  const mStr = minutes < 10 ? '0' + minutes : minutes;
  const sStr = seconds < 10 ? '0' + seconds : seconds;

  if (hours > 0) {
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  return 0;
}

function formatDurationDiff(startSec, endSec) {
  if (endSec <= startSec) return '(0s)';
  const diff = endSec - startSec;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  
  if (mins > 0) {
    return `(${mins}m ${secs}s duration)`;
  }
  return `(${secs}s duration)`;
}

// ==========================================
// 6. Video Loading & Management
// ==========================================

function loadYouTubeVideo(videoId, title = '') {
  if (!videoId) return;

  appState.currentVideoId = videoId;
  appState.currentVideoTitle = title || `Lecture Video (${videoId})`;
  appState.activePlayingClip = null;
  saveStateToStorage(false);

  const titleDisplay = document.getElementById('currentLectureTitle');
  const extBtn = document.getElementById('openExternalYoutubeBtn');

  if (titleDisplay) titleDisplay.textContent = appState.currentVideoTitle;
  if (extBtn) extBtn.href = `https://www.youtube.com/watch?v=${videoId}`;
  renderSkipZones();

  if (window.YT && window.YT.Player) {
    createYouTubePlayer(videoId, true, 0);
  } else {
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        createYouTubePlayer(videoId, true, 0);
      } else if (checkCount > 25) {
        clearInterval(checkInterval);
        showToast('YouTube Player API loading... Please wait a moment.', 'info');
      }
    }, 200);
  }
}

// ==========================================
// 7. Dropdowns & Library UI Rendering
// ==========================================

function renderSubjectDropdowns() {
  const subjectSelect = document.getElementById('subjectSelect');
  if (!subjectSelect) return;

  const currentVal = subjectSelect.value;
  subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject...</option>';

  appState.subjects.forEach(subj => {
    const opt = document.createElement('option');
    opt.value = subj;
    opt.textContent = subj;
    if (subj === currentVal) opt.selected = true;
    subjectSelect.appendChild(opt);
  });
}

function renderChapterDropdowns(selectedSubject = '') {
  const chapterSelect = document.getElementById('chapterSelect');
  const chapterFilterSelect = document.getElementById('chapterFilterSelect');
  if (!chapterSelect) return;

  const subject = selectedSubject || document.getElementById('subjectSelect').value;
  const chapters = (subject && appState.chapters[subject]) ? appState.chapters[subject] : [];

  chapterSelect.innerHTML = '<option value="" disabled selected>Select Chapter...</option>';
  chapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = ch;
    chapterSelect.appendChild(opt);
  });

  if (chapterFilterSelect) {
    chapterFilterSelect.innerHTML = '<option value="all">All Chapters</option>';
    let availableChapters = [];
    if (appState.activeFilterSubject !== 'all' && appState.chapters[appState.activeFilterSubject]) {
      availableChapters = appState.chapters[appState.activeFilterSubject];
    } else {
      Object.values(appState.chapters).forEach(arr => {
        arr.forEach(c => {
          if (!availableChapters.includes(c)) availableChapters.push(c);
        });
      });
    }

    availableChapters.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch;
      opt.textContent = ch;
      if (appState.activeFilterChapter === ch) opt.selected = true;
      chapterFilterSelect.appendChild(opt);
    });
  }
}

function renderSubjectFilterTabs() {
  const container = document.getElementById('subjectFilterTabs');
  if (!container) return;

  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `yt-chip ${(!appState.activeFilterDueToday && appState.activeFilterSubject === 'all') ? 'active' : ''}`;
  allBtn.textContent = `All (${appState.clips.length})`;
  allBtn.dataset.subject = 'all';
  allBtn.addEventListener('click', () => {
    appState.activeFilterDueToday = false;
    appState.activeFilterSubject = 'all';
    appState.activeFilterChapter = 'all';
    renderSubjectFilterTabs();
    renderChapterDropdowns();
    renderLibrary();
  });
  container.appendChild(allBtn);

  // Due Today Spaced Repetition Chip
  const now = Date.now();
  const dueTodayCount = appState.clips.filter(c => (!c.nextReviewDue || c.nextReviewDue <= now) && !c.mastered).length;
  const dueChip = document.createElement('button');
  dueChip.className = `yt-chip yt-chip-due ${appState.activeFilterDueToday ? 'active' : ''}`;
  dueChip.id = 'dueTodayFilterChip';
  dueChip.innerHTML = `📅 Due Today (<span id="dueTodayCountBadge">${dueTodayCount}</span>)`;
  dueChip.addEventListener('click', () => {
    appState.activeFilterDueToday = !appState.activeFilterDueToday;
    if (appState.activeFilterDueToday) {
      appState.activeFilterSubject = 'all';
    }
    renderSubjectFilterTabs();
    renderLibrary();
    showToast(appState.activeFilterDueToday ? 'Filtered: Questions Due Today! 📅' : 'Showing all questions.', 'info');
  });
  container.appendChild(dueChip);

  appState.subjects.forEach(subj => {
    const count = appState.clips.filter(c => c.subject === subj).length;
    const btn = document.createElement('button');
    btn.className = `yt-chip ${(!appState.activeFilterDueToday && appState.activeFilterSubject === subj) ? 'active' : ''}`;
    btn.textContent = `${subj} (${count})`;
    btn.dataset.subject = subj;
    btn.addEventListener('click', () => {
      appState.activeFilterDueToday = false;
      appState.activeFilterSubject = subj;
      appState.activeFilterChapter = 'all';
      renderSubjectFilterTabs();
      renderChapterDropdowns(subj);
      renderLibrary();
    });
    container.appendChild(btn);
  });
}

function renderLibrary() {
  const container = document.getElementById('clipsContainer');
  const emptyState = document.getElementById('emptyLibraryState');
  const countBadge = document.getElementById('libraryCountBadge');
  const totalClipsMeta = document.getElementById('totalSavedClipsMeta');
  const now = Date.now();
  const dueTodayCount = appState.clips.filter(c => (!c.nextReviewDue || c.nextReviewDue <= now) && !c.mastered).length;
  const dueBadge = document.getElementById('dueTodayCountBadge');
  if (dueBadge) dueBadge.textContent = dueTodayCount;

  // Mobile Bottom Nav Badges
  const mobClipsBadge = document.getElementById('mobClipsBadge');
  const mobDueBadge = document.getElementById('mobDueBadge');
  if (mobClipsBadge) mobClipsBadge.textContent = appState.clips.length;
  if (mobDueBadge) {
    mobDueBadge.textContent = dueTodayCount;
    mobDueBadge.style.display = dueTodayCount > 0 ? 'inline' : 'none';
  }

  let filtered = appState.clips.filter(clip => {
    if (appState.activeFilterDueToday) {
      if (clip.mastered || (clip.nextReviewDue && clip.nextReviewDue > now)) return false;
    }
    if (appState.activeFilterSubject !== 'all' && clip.subject !== appState.activeFilterSubject) return false;
    if (appState.activeFilterChapter !== 'all' && clip.chapter !== appState.activeFilterChapter) return false;
    if (appState.activeFilterTag !== 'all' && clip.tag !== appState.activeFilterTag) return false;
    if (appState.searchQuery) {
      const q = appState.searchQuery.toLowerCase();
      const matchTitle = clip.title && clip.title.toLowerCase().includes(q);
      const matchNote = clip.note && clip.note.toLowerCase().includes(q);
      const matchSubj = clip.subject && clip.subject.toLowerCase().includes(q);
      const matchCh = clip.chapter && clip.chapter.toLowerCase().includes(q);
      if (!matchTitle && !matchNote && !matchSubj && !matchCh) return false;
    }
    return true;
  });

  if (countBadge) countBadge.textContent = `${filtered.length} saved`;
  if (totalClipsMeta) totalClipsMeta.textContent = `${appState.clips.length} revision timestamps saved`;
  container.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'flex';
      container.appendChild(emptyState);
    }
    return;
  }

  filtered.forEach(clip => {
    const card = createClipCardElement(clip);
    container.appendChild(card);
  });
}

function getTagClass(tag) {
  switch (tag) {
    case 'Tricky Question': return 'tag-tricky';
    case 'Core Concept': return 'tag-concept';
    case 'Formula & Derivation': return 'tag-formula';
    case 'Teacher\'s Secret Trick': return 'tag-trick';
    case 'Exam Trap': return 'tag-trap';
    default: return 'tag-doubt';
  }
}

function renderClipNoteHtml(noteText) {
  if (!noteText) return '';
  if (noteText.includes('MASTER TEACHER') || noteText.includes('Spoken Transcript') || noteText.includes('TOPPER') || noteText.includes('FORMULA')) {
    return `<div class="yt-clip-rich-notes">${formatAiNotesToChatGPTCards(noteText, '')}</div>`;
  }
  return `<div class="yt-clip-note">💡 ${escapeHtml(noteText)}</div>`;
}

function createClipCardElement(clip) {
  const card = document.createElement('div');
  const tagClass = getTagClass(clip.tag);
  card.className = 'yt-clip-card';
  card.dataset.id = clip.id;

  const durationStr = clip.endTime ? `${clip.startTime} - ${clip.endTime}` : `@ ${clip.startTime}`;
  const externalLink = `https://youtu.be/${clip.videoId}?t=${clip.startSeconds}`;
  const thumbnailImg = `https://img.youtube.com/vi/${clip.videoId}/hqdefault.jpg`;

  const isDue = (!clip.nextReviewDue || clip.nextReviewDue <= Date.now()) && !clip.mastered;
  const levelStr = clip.mastered ? '🏆 Mastered' : (isDue ? '📅 Due Today' : `⏳ Lvl ${clip.repetitionLevel || 1}`);
  const srBadgeClass = isDue ? 'sr-due-badge' : 'sr-level-badge';

  card.innerHTML = `
    <!-- Video Mini Thumbnail -->
    <div class="yt-clip-thumb">
      <img src="${thumbnailImg}" alt="${escapeHtml(clip.title)}" class="yt-thumb-bg" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=80';" />
      <span class="yt-thumb-tag ${tagClass}">${clip.tag || 'Concept'}</span>
      <span class="yt-thumb-time">${durationStr}</span>
    </div>

    <!-- Clip Info Details -->
    <div class="yt-clip-details">
      <div>
        <h4 class="yt-clip-title" title="${escapeHtml(clip.title)}">${escapeHtml(clip.title)}</h4>
        <div class="yt-clip-meta">
          <span>${clip.subject || 'General'}</span> • <span>${clip.chapter || 'Topic'}</span>
          <span class="${srBadgeClass}">${levelStr}</span>
        </div>
        ${clip.aiVisualUrl ? `<div class="yt-clip-visual"><img src="${clip.aiVisualUrl}" alt="${escapeHtml(clip.title)}" class="yt-clip-visual-img" loading="lazy" /></div>` : ''}
        ${clip.note ? renderClipNoteHtml(clip.note) : ''}
        ${clip.note ? `<button type="button" class="yt-btn-read-note" data-action="read-note">🔊 Read Notes</button>` : ''}
        ${clip.voiceNoteBase64 ? `<button type="button" class="yt-btn-play-voice" data-action="play-voice">🎙️ Listen Memo</button>` : ''}
      </div>

      <div class="yt-clip-actions">
        <button class="yt-mini-btn btn-play" data-action="play" title="Play with Auto-Stop">
          ▶ Play
        </button>
        <button class="yt-mini-btn ${clip.mastered ? 'active-mastered' : ''}" data-action="toggle-master" title="${clip.mastered ? 'Mastered' : 'Mark as Mastered'}">
          ${clip.mastered ? '✅' : '⚪'}
        </button>
        <button class="yt-mini-btn" data-action="edit" title="Edit Clip">
          ✏️
        </button>
        <button class="yt-mini-btn" data-action="delete" title="Delete Clip">
          🗑
        </button>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    // If clicking card outside buttons, play
    if (!e.target.closest('button') && !e.target.closest('a')) {
      playSpecificClip(clip);
    }
  });

  card.querySelector('[data-action="play"]').addEventListener('click', (e) => {
    e.stopPropagation();
    playSpecificClip(clip);
  });

  const readNoteBtn = card.querySelector('[data-action="read-note"]');
  if (readNoteBtn) {
    readNoteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      readOutNoteWithTTS(clip.note);
    });
  }

  const playVoiceBtn = card.querySelector('[data-action="play-voice"]');
  if (playVoiceBtn) {
    playVoiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playVoiceAudio(clip.voiceNoteBase64);
    });
  }

  card.querySelector('[data-action="toggle-master"]').addEventListener('click', (e) => {
    e.stopPropagation();
    clip.mastered = !clip.mastered;
    saveStateToStorage(true);
    renderLibrary();
    showToast(clip.mastered ? 'Marked as Mastered! 🎉' : 'Moved to practice list.', 'info');
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(clip);
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete revision bookmark "${clip.title}"?`)) {
      appState.clips = appState.clips.filter(c => c.id !== clip.id);
      saveStateToStorage(true);
      renderSubjectFilterTabs();
      renderLibrary();
      showToast('Clip deleted.', 'info');
    }
  });

  return card;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateHeaderStats() {
  const totalClips = document.querySelectorAll('#totalClipsCount');
  const totalSubjects = document.querySelectorAll('#totalSubjectsCount');
  const totalMastered = document.querySelectorAll('#totalMasteredCount');
  const tabBadge = document.getElementById('tabLibraryCountBadge');

  totalClips.forEach(el => el.textContent = appState.clips.length);
  totalSubjects.forEach(el => el.textContent = appState.subjects.length);
  if (tabBadge) tabBadge.textContent = appState.clips.length;
  
  const masteredCount = appState.clips.filter(c => c.mastered).length;
  totalMastered.forEach(el => el.textContent = masteredCount);
}

// ==========================================
// 8. Clip Playback & Auto-Stop Execution
// ==========================================

function switchMainTab(tabId) {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabViews = document.querySelectorAll('.tab-page-view');

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === tabId);
  });

  tabViews.forEach(view => {
    view.classList.toggle('active', view.id === tabId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function playSpecificClip(clip) {
  dismissClipOverlay();
  
  // Auto-switch to Studio tab so user sees the large player!
  switchMainTab('studioView');

  appState.activePlayingClip = {
    clipId: clip.id,
    endSeconds: clip.endSeconds,
    title: clip.title
  };

  const startSec = clip.startSeconds || 0;

  if (!ytPlayer || appState.currentVideoId !== clip.videoId) {
    appState.currentVideoId = clip.videoId;
    appState.currentVideoTitle = clip.videoTitle || 'Lecture';
    saveStateToStorage(false);

    const titleDisplay = document.getElementById('currentLectureTitle');
    if (titleDisplay) titleDisplay.textContent = appState.currentVideoTitle;

    createYouTubePlayer(clip.videoId, true, startSec);
  } else {
    try {
      ytPlayer.seekTo(startSec, true);
      ytPlayer.playVideo();
    } catch (e) {
      createYouTubePlayer(clip.videoId, true, startSec);
    }
  }

  showToast(`▶ Playing: "${clip.title}" from ${clip.startTime}${clip.endTime ? ` (Stops at ${clip.endTime})` : ''}`, 'info');
}

// ==========================================
// 8.5 Auto-Skip Zones (Filler / Chit-Chat Skipper)
// ==========================================

function handleToggleSkipZone() {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
    showToast('Please load and play a video first!', 'error');
    return;
  }

  const currentSec = Math.floor(ytPlayer.getCurrentTime());
  const mainBtn = document.getElementById('skipZoneToggleBtn');
  const mainText = document.getElementById('skipZoneBtnText');
  const fsBtn = document.getElementById('fsSkipFillerBtn');
  const fsText = document.getElementById('fsSkipBtnText');

  if (appState.activeRecordingSkipStart === null) {
    // START RECORDING SKIP ZONE
    appState.activeRecordingSkipStart = currentSec;
    const timeFormatted = formatSecondsToTime(currentSec);

    if (mainBtn) mainBtn.classList.add('recording');
    if (fsBtn) fsBtn.classList.add('recording');
    if (mainText) mainText.textContent = `⏭️ Stop Skip at Now (${timeFormatted} → ...)`;
    if (fsText) fsText.textContent = `⏭️ Stop Skip (${timeFormatted})`;

    showToast(`🚫 Skip Zone Started at ${timeFormatted}. Click again when teacher returns to topic!`, 'info');
  } else {
    // FINISH RECORDING SKIP ZONE
    const startSec = appState.activeRecordingSkipStart;
    const endSec = currentSec;

    if (endSec <= startSec + 2) {
      showToast('Skip zone too short! Minimum 3 seconds required.', 'error');
      resetSkipZoneButtonUI();
      appState.activeRecordingSkipStart = null;
      return;
    }

    const newZone = {
      id: 'skip-' + Date.now(),
      videoId: appState.currentVideoId || 'default',
      startSeconds: startSec,
      startTime: formatSecondsToTime(startSec),
      endSeconds: endSec,
      endTime: formatSecondsToTime(endSec),
      label: 'Teacher Chit-Chat / Filler',
      createdAt: Date.now()
    };

    if (!appState.skipZones) appState.skipZones = [];
    appState.skipZones.push(newZone);

    appState.activeRecordingSkipStart = null;
    resetSkipZoneButtonUI();
    saveStateToStorage(true);
    renderSkipZones();

    showToast(`✅ Saved Skip Zone (${newZone.startTime} - ${newZone.endTime}). Main timeline will now teleport over this!`, 'success');
  }
}

function resetSkipZoneButtonUI() {
  const mainBtn = document.getElementById('skipZoneToggleBtn');
  const mainText = document.getElementById('skipZoneBtnText');
  const fsBtn = document.getElementById('fsSkipFillerBtn');
  const fsText = document.getElementById('fsSkipBtnText');

  if (mainBtn) mainBtn.classList.remove('recording');
  if (fsBtn) fsBtn.classList.remove('recording');
  if (mainText) mainText.textContent = 'Mark Filler Start';
  if (fsText) fsText.textContent = 'Skip Filler';
}

function deleteSkipZone(id) {
  appState.skipZones = (appState.skipZones || []).filter(z => z.id !== id);
  saveStateToStorage(true);
  renderSkipZones();
  showToast('Skip zone removed.', 'info');
}

function renderSkipZones(forceOpen = false) {
  const strip = document.getElementById('skipZonesStrip');
  const chipsList = document.getElementById('skipZonesChipsList');
  const countLabel = document.getElementById('skipZonesCountLabel');
  const toggleBtn = document.getElementById('toggleSkipZonesDrawerBtn');
  const badgeText = document.getElementById('skipCountBadgeText');
  if (!strip || !chipsList) return;

  const currentZones = (appState.skipZones || []).filter(z => z.videoId === appState.currentVideoId);

  if (currentZones.length === 0) {
    strip.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    chipsList.innerHTML = '';
    return;
  }

  const totalSecondsCut = currentZones.reduce((acc, z) => acc + (z.endSeconds - z.startSeconds), 0);
  if (toggleBtn) {
    toggleBtn.style.display = 'inline-flex';
    if (badgeText) badgeText.textContent = `${currentZones.length} Filler Cut (${totalSecondsCut}s)`;
  }

  if (countLabel) countLabel.textContent = `${currentZones.length} filler zone${currentZones.length > 1 ? 's' : ''} (${totalSecondsCut}s cut)`;
  chipsList.innerHTML = '';

  currentZones.forEach(z => {
    const chip = document.createElement('div');
    chip.className = 'skip-zone-chip';
    chip.innerHTML = `
      <span>🚫 ${z.startTime} - ${z.endTime} (${z.endSeconds - z.startSeconds}s)</span>
      <button type="button" title="Delete this skip zone" data-id="${z.id}">✕</button>
    `;
    chip.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSkipZone(z.id);
    });
    chipsList.appendChild(chip);
  });

  if (forceOpen) {
    strip.style.display = 'flex';
  }
}

function quickSkip(seconds) {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
    showToast('Play a video first!', 'error');
    return;
  }
  const cur = ytPlayer.getCurrentTime() || 0;
  ytPlayer.seekTo(cur + seconds, true);
  showToast(`⏩ Jumped +${seconds}s ahead!`, 'info');
}

// ==========================================
// 8.6 Voice Note Recorder & Spaced Repetition Logic
// ==========================================

let mediaRecorder = null;
let audioChunks = [];
let voiceRecordInterval = null;
let voiceRecordSeconds = 0;
let recordedVoiceBase64 = null;
let activePlayingAudio = null;

function handleSpacedRepetitionRating(rating) {
  if (!appState.activePlayingClip) {
    dismissClipOverlay();
    return;
  }

  const clip = appState.clips.find(c => c.id === appState.activePlayingClip.clipId);
  if (!clip) {
    dismissClipOverlay();
    return;
  }

  const now = Date.now();
  clip.lastReviewedAt = now;

  let days = 1;
  if (rating === 'hard') {
    clip.repetitionLevel = 1;
    days = 1;
  } else if (rating === 'good') {
    clip.repetitionLevel = Math.min(5, (clip.repetitionLevel || 1) + 1);
    const intervals = [1, 3, 7, 14, 30];
    days = intervals[clip.repetitionLevel - 1] || 3;
  } else if (rating === 'easy') {
    clip.repetitionLevel = Math.min(6, (clip.repetitionLevel || 1) + 2);
    if (clip.repetitionLevel >= 5) {
      clip.mastered = true;
      days = 30;
    } else {
      days = 7;
    }
  }

  clip.nextReviewDue = now + (days * 24 * 3600 * 1000);
  saveStateToStorage(true);
  renderLibrary();
  dismissClipOverlay();

  showToast(`🧠 Recall Logged (${rating.toUpperCase()})! Next review in ${days} day${days > 1 ? 's' : ''}.`, 'success');
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Microphone access is not supported on this browser.', 'error');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        recordedVoiceBase64 = reader.result;
        const hiddenInput = document.getElementById('voiceNoteBase64Input');
        if (hiddenInput) hiddenInput.value = recordedVoiceBase64;

        const previewBox = document.getElementById('voicePreviewBox');
        if (previewBox) previewBox.style.display = 'flex';
        resetVoiceRecordButtonUI();
        showToast('🎙️ Voice Memo Recorded! Transcribing with Groq Whisper... ⚡', 'info');

        // Transcribe voice note automatically using Groq Whisper (Primary Speech Specialist)
        transcribeAudioBlobWithGroq(audioBlob).then(transcript => {
          if (transcript) {
            const noteInput = document.getElementById('clipNoteInput');
            if (noteInput) {
              if (noteInput.value.trim()) {
                noteInput.value = `${noteInput.value.trim()}\n\n🎙️ Voice Memo (Transcribed via Groq Whisper):\n"${transcript}"`;
              } else {
                noteInput.value = `🎙️ Voice Memo (Transcribed via Groq Whisper):\n"${transcript}"`;
              }
              noteInput.focus();
            }
            showToast('⚡ Groq Whisper Transcribed Your Voice Note! 🎯', 'success');
          }
        });
      };
      reader.readAsDataURL(audioBlob);

      // Stop all mic tracks
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    voiceRecordSeconds = 0;

    const recordBtn = document.getElementById('startVoiceRecordBtn');
    const timerLabel = document.getElementById('voiceRecordTimer');
    const btnText = document.getElementById('voiceRecordBtnText');

    if (recordBtn) recordBtn.classList.add('recording');
    if (btnText) btnText.textContent = '⏹ Stop & Save Memo';
    if (timerLabel) {
      timerLabel.style.display = 'inline';
      timerLabel.textContent = '00:00 / 02:00';
    }

    voiceRecordInterval = setInterval(() => {
      voiceRecordSeconds++;
      const mins = Math.floor(voiceRecordSeconds / 60);
      const secs = voiceRecordSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 02:00`;
      
      if (timerLabel) timerLabel.textContent = formatted;
      if (voiceRecordSeconds >= 120) {
        stopVoiceRecording();
      }
    }, 1000);

  } catch (err) {
    console.error('Microphone error:', err);
    showToast('Microphone permission denied or unavailable.', 'error');
    resetVoiceRecordButtonUI();
  }
}

function stopVoiceRecording() {
  if (voiceRecordInterval) {
    clearInterval(voiceRecordInterval);
    voiceRecordInterval = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function resetVoiceRecordButtonUI() {
  const recordBtn = document.getElementById('startVoiceRecordBtn');
  const timerLabel = document.getElementById('voiceRecordTimer');
  const btnText = document.getElementById('voiceRecordBtnText');

  if (recordBtn) recordBtn.classList.remove('recording');
  if (btnText) btnText.textContent = 'Record Voice Memo';
  if (timerLabel) timerLabel.style.display = 'none';
}

function playVoiceAudio(base64Audio) {
  if (!base64Audio) return;
  try {
    if (activePlayingAudio) {
      activePlayingAudio.pause();
      activePlayingAudio = null;
    }
    activePlayingAudio = new Audio(base64Audio);
    activePlayingAudio.play();
    showToast('🔊 Playing Teacher Trick Voice Memo...', 'info');
  } catch (e) {
    showToast('Error playing audio memo.', 'error');
  }
}

// ==========================================
// 9. Event Listeners & Forms
// ==========================================

function setupEventListeners() {
  
  // 0. Top-Level Tab Switcher
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetViewId = btn.dataset.target;
      if (targetViewId) {
        switchMainTab(targetViewId);
      }
    });
  });

  // 1. YouTube Top Search Form (Loads URL or filters clips)
  const topSearchForm = document.getElementById('topSearchForm') || document.getElementById('loadVideoForm');
  const searchInput = document.getElementById('youtubeUrlInput');
  const clearSearchBtn = document.getElementById('clearSearchInputBtn');

  // 1.0 Mobile Search Mode Toggle (YouTube Style Expanding Header Search)
  const headerElem = document.querySelector('.yt-header');
  const mobileSearchTriggerBtn = document.getElementById('mobileSearchTriggerBtn');
  const mobileSearchBackBtn = document.getElementById('mobileSearchBackBtn');

  function enterMobileSearch() {
    if (headerElem) headerElem.classList.add('search-mode');
    if (searchInput) {
      searchInput.focus();
      if (searchInput.value) {
        searchInput.select();
      }
    }
  }

  function exitMobileSearch() {
    if (headerElem) headerElem.classList.remove('search-mode');
  }

  if (mobileSearchTriggerBtn) {
    mobileSearchTriggerBtn.addEventListener('click', enterMobileSearch);
  }

  if (mobileSearchBackBtn) {
    mobileSearchBackBtn.addEventListener('click', exitMobileSearch);
  }

  if (topSearchForm) {
    topSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = searchInput ? searchInput.value.trim() : '';
      if (!val) return;

      const videoId = extractYouTubeVideoId(val);
      if (videoId) {
        const title = `Lecture Video (${videoId})`;
        loadYouTubeVideo(videoId, title);
        exitMobileSearch();
        showToast('YouTube Lecture Loaded! 📺', 'success');
      } else {
        appState.searchQuery = val;
        renderLibrary();
        showToast(`Filtered clips for "${val}"`, 'info');
      }
    });
  }

  if (searchInput && clearSearchBtn) {
    searchInput.addEventListener('input', (e) => {
      clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
      if (!extractYouTubeVideoId(e.target.value)) {
        appState.searchQuery = e.target.value;
        renderLibrary();
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      appState.searchQuery = '';
      renderLibrary();
    });
  }

  // 1.1 Bookmark Clip Quick Jump / Bottom Sheet Drawer Toggle
  function openBookmarkDrawer() {
    const descBox = document.getElementById('ytDescriptionBox');
    const backdrop = document.getElementById('drawerBackdrop');
    const titleInput = document.getElementById('clipTitleInput');
    if (descBox) descBox.classList.add('drawer-open');
    if (backdrop) backdrop.classList.add('active');
    if (window.innerWidth > 768 && descBox) {
      descBox.scrollIntoView({ behavior: 'smooth' });
    }
    if (titleInput) titleInput.focus();
  }

  function closeBookmarkDrawer() {
    const descBox = document.getElementById('ytDescriptionBox');
    const backdrop = document.getElementById('drawerBackdrop');
    if (descBox) descBox.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.remove('active');
  }

  const openCaptureFormToggleBtn = document.getElementById('openCaptureFormToggleBtn');
  if (openCaptureFormToggleBtn) {
    openCaptureFormToggleBtn.addEventListener('click', openBookmarkDrawer);
  }

  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeBookmarkDrawer);
  }

  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeBookmarkDrawer);
  }

  // 1.15 Tools Bottom Sheet Open / Close
  function openToolsSheet() {
    const sheet = document.getElementById('toolsBottomSheet');
    const backdrop = document.getElementById('toolsDrawerBackdrop');
    if (sheet) sheet.classList.add('sheet-open');
    if (backdrop) {
      backdrop.style.display = 'block';
      setTimeout(() => backdrop.classList.add('active'), 10);
    }
  }

  function closeToolsSheet() {
    const sheet = document.getElementById('toolsBottomSheet');
    const backdrop = document.getElementById('toolsDrawerBackdrop');
    if (sheet) sheet.classList.remove('sheet-open');
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.style.display = 'none', 250);
    }
  }

  const moreToolsDropdownBtn = document.getElementById('moreToolsDropdownBtn');
  if (moreToolsDropdownBtn) {
    moreToolsDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openToolsSheet();
    });
  }

  const closeToolsSheetBtn = document.getElementById('closeToolsSheetBtn');
  if (closeToolsSheetBtn) {
    closeToolsSheetBtn.addEventListener('click', closeToolsSheet);
  }

  const toolsDrawerBackdrop = document.getElementById('toolsDrawerBackdrop');
  if (toolsDrawerBackdrop) {
    toolsDrawerBackdrop.addEventListener('click', closeToolsSheet);
  }

  // Speed chips inside Sheet
  const sheetSpeedButtons = document.querySelectorAll('.sheet-speed-btn');
  sheetSpeedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sheetSpeedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
        ytPlayer.setPlaybackRate(speed);
        showToast(`Speed set to ${speed}x ⚡`, 'info');
      }
    });
  });

  const sheetFullscreenBtn = document.getElementById('sheetFullscreenBtn');
  if (sheetFullscreenBtn) {
    sheetFullscreenBtn.addEventListener('click', () => {
      closeToolsSheet();
      const fsBtn = document.getElementById('fullscreenBtn');
      if (fsBtn) fsBtn.click();
    });
  }

  // 1.2 Auto-Skip Zone & Quick Skip Buttons
  const skipZoneToggleBtn = document.getElementById('skipZoneToggleBtn');
  if (skipZoneToggleBtn) {
    skipZoneToggleBtn.addEventListener('click', () => {
      handleToggleSkipZone();
      closeToolsSheet();
    });
  }

  const fsSkipFillerBtn = document.getElementById('fsSkipFillerBtn');
  if (fsSkipFillerBtn) {
    fsSkipFillerBtn.addEventListener('click', handleToggleSkipZone);
  }

  const toggleSkipZonesDrawerBtn = document.getElementById('toggleSkipZonesDrawerBtn');
  const skipZonesStrip = document.getElementById('skipZonesStrip');
  if (toggleSkipZonesDrawerBtn && skipZonesStrip) {
    toggleSkipZonesDrawerBtn.addEventListener('click', () => {
      const isHidden = skipZonesStrip.style.display === 'none' || !skipZonesStrip.style.display;
      skipZonesStrip.style.display = isHidden ? 'flex' : 'none';
    });
  }

  const closeSkipStripBtn = document.getElementById('closeSkipStripBtn');
  if (closeSkipStripBtn && skipZonesStrip) {
    closeSkipStripBtn.addEventListener('click', () => {
      skipZonesStrip.style.display = 'none';
    });
  }

  const quickSkip30sBtn = document.getElementById('quickSkip30sBtn');
  if (quickSkip30sBtn) {
    quickSkip30sBtn.addEventListener('click', () => {
      quickSkip(30);
      closeToolsSheet();
    });
  }

  const quickSkip1mBtn = document.getElementById('quickSkip1mBtn');
  if (quickSkip1mBtn) {
    quickSkip1mBtn.addEventListener('click', () => {
      quickSkip(60);
      closeToolsSheet();
    });
  }

  // 1.3 Voice Memo Recorder Buttons
  const startVoiceRecordBtn = document.getElementById('startVoiceRecordBtn');
  if (startVoiceRecordBtn) {
    startVoiceRecordBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopVoiceRecording();
      } else {
        startVoiceRecording();
      }
    });
  }

  const playVoicePreviewBtn = document.getElementById('playVoicePreviewBtn');
  if (playVoicePreviewBtn) {
    playVoicePreviewBtn.addEventListener('click', () => {
      const b64 = recordedVoiceBase64 || document.getElementById('voiceNoteBase64Input').value;
      if (b64) playVoiceAudio(b64);
    });
  }

  const deleteVoicePreviewBtn = document.getElementById('deleteVoicePreviewBtn');
  if (deleteVoicePreviewBtn) {
    deleteVoicePreviewBtn.addEventListener('click', () => {
      recordedVoiceBase64 = null;
      document.getElementById('voiceNoteBase64Input').value = '';
      document.getElementById('voicePreviewBox').style.display = 'none';
      showToast('Voice note removed.', 'info');
    });
  }

  // 1.35 Auto-Fetch YouTube Transcript for Timeframe & AI Visuals
  const fetchTranscriptBtn = document.getElementById('fetchTranscriptBtn');
  if (fetchTranscriptBtn) {
    fetchTranscriptBtn.addEventListener('click', () => handleFetchTranscriptForTimeframe(false));
  }

  const editFetchTranscriptBtn = document.getElementById('editFetchTranscriptBtn');
  if (editFetchTranscriptBtn) {
    editFetchTranscriptBtn.addEventListener('click', () => handleFetchTranscriptForTimeframe(true));
  }

  const genVisualCardBtn = document.getElementById('genVisualCardBtn');
  if (genVisualCardBtn) {
    genVisualCardBtn.addEventListener('click', () => handleGenerateVisualCard());
  }

  const removeRichFlashcardBtn = document.getElementById('removeRichFlashcardBtn');
  if (removeRichFlashcardBtn) {
    removeRichFlashcardBtn.addEventListener('click', () => {
      const box = document.getElementById('richAiFlashcardBox');
      const input = document.getElementById('aiVisualUrlInput');
      if (box) box.style.display = 'none';
      if (input) input.value = '';
    });
  }

  const chatgptTtsBtn = document.getElementById('chatgptTtsBtn');
  if (chatgptTtsBtn) {
    chatgptTtsBtn.addEventListener('click', () => {
      const note = document.getElementById('clipNoteInput').value;
      if (note) readOutNoteWithTTS(note);
    });
  }

  const chatgptRedrawBtn = document.getElementById('chatgptRedrawBtn');
  if (chatgptRedrawBtn) {
    chatgptRedrawBtn.addEventListener('click', () => handleGenerateVisualCard());
  }

  const removeAiVisualBtn = document.getElementById('removeAiVisualBtn');
  if (removeAiVisualBtn) {
    removeAiVisualBtn.addEventListener('click', () => {
      const container = document.getElementById('aiVisualPreviewContainer');
      const input = document.getElementById('aiVisualUrlInput');
      if (container) container.style.display = 'none';
      if (input) input.value = '';
      showToast('Visual removed from bookmark.', 'info');
    });
  }

  // 1.4 Spaced Repetition Due Today Filter Chip
  const dueTodayFilterChip = document.getElementById('dueTodayFilterChip');
  if (dueTodayFilterChip) {
    dueTodayFilterChip.addEventListener('click', () => {
      appState.activeFilterDueToday = !appState.activeFilterDueToday;
      dueTodayFilterChip.classList.toggle('active', appState.activeFilterDueToday);
      if (appState.activeFilterDueToday) {
        document.querySelectorAll('#subjectFilterTabs .yt-chip').forEach(c => {
          if (c !== dueTodayFilterChip) c.classList.remove('active');
        });
      }
      renderLibrary();
      showToast(appState.activeFilterDueToday ? 'Filtered: Questions Due Today! 📅' : 'Showing all questions.', 'info');
    });
  }

  // 1.5 Native Mobile Bottom Navigation
  const mobNavItems = document.querySelectorAll('.mob-nav-item');
  mobNavItems.forEach(item => {
    item.addEventListener('click', () => {
      mobNavItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const target = item.dataset.target;

      if (target === 'player') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target === 'bookmark') {
        openBookmarkDrawer();
      } else if (target === 'clips') {
        appState.activeFilterDueToday = false;
        renderSubjectFilterTabs();
        renderLibrary();
        const clipsElem = document.getElementById('clipsContainer');
        if (clipsElem) clipsElem.scrollIntoView({ behavior: 'smooth' });
      } else if (target === 'due') {
        appState.activeFilterDueToday = true;
        renderSubjectFilterTabs();
        renderLibrary();
        const clipsElem = document.getElementById('clipsContainer');
        if (clipsElem) clipsElem.scrollIntoView({ behavior: 'smooth' });
        showToast('📅 Showing Questions Due Today!', 'info');
      } else if (target === 'cloud') {
        const modal = document.getElementById('firebaseModalBackdrop');
        if (modal) modal.classList.add('active');
      }
    });
  });

  // 2. Capture Start Time Button (Desktop + Floating Dock)
  function handleCaptureStartTime() {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
      showToast('Please load and play a video first!', 'error');
      return;
    }
    const sec = Math.floor(ytPlayer.getCurrentTime());
    const timeStr = formatSecondsToTime(sec);
    const startInput = document.getElementById('startTimeInput');
    const startPreview = document.getElementById('startBtnPreview');
    const fsStartPreview = document.getElementById('fsStartPreview');
    const fsLive = document.getElementById('fsLiveTime');

    if (startInput) startInput.value = timeStr;
    if (startPreview) startPreview.textContent = timeStr;
    if (fsStartPreview) fsStartPreview.textContent = timeStr;
    if (fsLive) fsLive.textContent = timeStr;

    updateDurationPreview();
    showToast(`Captured Start Time: ${timeStr} ⚡`, 'info');
  }

  const captureStartBtn = document.getElementById('captureStartBtn');
  if (captureStartBtn) captureStartBtn.addEventListener('click', handleCaptureStartTime);

  const fsCaptureStartBtn = document.getElementById('fsCaptureStartBtn');
  if (fsCaptureStartBtn) fsCaptureStartBtn.addEventListener('click', handleCaptureStartTime);

  // 3. Capture End Time Button (Auto-Stop) (Desktop + Floating Dock)
  function handleCaptureEndTime() {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
      showToast('Please load and play a video first!', 'error');
      return;
    }
    const sec = Math.floor(ytPlayer.getCurrentTime());
    const timeStr = formatSecondsToTime(sec);
    const endInput = document.getElementById('endTimeInput');
    const endPreview = document.getElementById('endBtnPreview');
    const fsEndPreview = document.getElementById('fsEndPreview');

    if (endInput) endInput.value = timeStr;
    if (endPreview) endPreview.textContent = timeStr;
    if (fsEndPreview) fsEndPreview.textContent = timeStr;

    updateDurationPreview();
    showToast(`Captured End Time (Auto-Stop): ${timeStr} ⏹`, 'info');
  }

  const captureEndBtn = document.getElementById('captureEndBtn');
  if (captureEndBtn) captureEndBtn.addEventListener('click', handleCaptureEndTime);

  const fsCaptureEndBtn = document.getElementById('fsCaptureEndBtn');
  if (fsCaptureEndBtn) fsCaptureEndBtn.addEventListener('click', handleCaptureEndTime);

  // 3.2 Floating Dock Quick Save Button
  const fsQuickSaveBtn = document.getElementById('fsQuickSaveBtn');
  if (fsQuickSaveBtn) {
    fsQuickSaveBtn.addEventListener('click', () => {
      openBookmarkDrawer();
      showToast('Fill Topic Title to save your revision clip! ✍️', 'info');
    });
  }

  // 4. Add New Subject Inline
  document.getElementById('addNewSubjectBtn').addEventListener('click', () => {
    const newSubj = prompt('Enter New Subject Name (e.g. Physics, History, Coding):');
    if (newSubj && newSubj.trim()) {
      const name = newSubj.trim();
      if (!appState.subjects.includes(name)) {
        appState.subjects.push(name);
        appState.chapters[name] = [];
        saveStateToStorage(true);
        renderSubjectDropdowns();
        renderSubjectFilterTabs();
        document.getElementById('subjectSelect').value = name;
        renderChapterDropdowns(name);
        showToast(`Subject "${name}" added!`, 'success');
      }
    }
  });

  // 5. Add New Chapter Inline
  document.getElementById('addNewChapterBtn').addEventListener('click', () => {
    const currentSubj = document.getElementById('subjectSelect').value;
    if (!currentSubj) {
      showToast('Please select a subject first before adding a chapter.', 'error');
      return;
    }

    const newCh = prompt(`Enter New Chapter Name for "${currentSubj}":`);
    if (newCh && newCh.trim()) {
      const name = newCh.trim();
      if (!appState.chapters[currentSubj]) appState.chapters[currentSubj] = [];
      if (!appState.chapters[currentSubj].includes(name)) {
        appState.chapters[currentSubj].push(name);
        saveStateToStorage(true);
        renderChapterDropdowns(currentSubj);
        document.getElementById('chapterSelect').value = name;
        showToast(`Chapter "${name}" added to ${currentSubj}!`, 'success');
      }
    }
  });

  document.getElementById('subjectSelect').addEventListener('change', (e) => {
    renderChapterDropdowns(e.target.value);
  });

  // 6. Save Revision Clip Form
  const saveClipForm = document.getElementById('saveClipForm');
  saveClipForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!appState.currentVideoId) {
      showToast('Please load a YouTube video first!', 'error');
      return;
    }

    const startTimeStr = document.getElementById('startTimeInput').value.trim();
    const endTimeStr = document.getElementById('endTimeInput').value.trim();
    const subject = document.getElementById('subjectSelect').value;
    const chapter = document.getElementById('chapterSelect').value;
    const title = document.getElementById('clipTitleInput').value.trim();
    const tag = document.getElementById('tagSelect').value;
    const note = document.getElementById('clipNoteInput').value.trim();
    const voiceNoteBase64 = document.getElementById('voiceNoteBase64Input').value || null;
    const aiVisualUrl = document.getElementById('aiVisualUrlInput') ? document.getElementById('aiVisualUrlInput').value.trim() : null;

    const startSeconds = parseTimeToSeconds(startTimeStr);
    const endSeconds = endTimeStr ? parseTimeToSeconds(endTimeStr) : null;

    if (endSeconds && endSeconds <= startSeconds) {
      showToast('End time must be greater than Start time!', 'error');
      return;
    }

    const now = Date.now();
    const newClip = {
      id: 'clip-' + now,
      videoId: appState.currentVideoId,
      videoTitle: appState.currentVideoTitle,
      videoUrl: `https://www.youtube.com/watch?v=${appState.currentVideoId}`,
      startTime: startTimeStr,
      startSeconds: startSeconds,
      endTime: endTimeStr,
      endSeconds: endSeconds,
      subject: subject,
      chapter: chapter,
      title: title,
      tag: tag,
      note: note,
      aiVisualUrl: aiVisualUrl || null,
      voiceNoteBase64: voiceNoteBase64,
      repetitionLevel: 0,
      lastReviewedAt: now,
      nextReviewDue: now,
      mastered: false,
      createdAt: now
    };

    appState.clips.unshift(newClip);
    saveStateToStorage(true);
    renderSubjectFilterTabs();
    renderLibrary();

    document.getElementById('startTimeInput').value = '';
    document.getElementById('endTimeInput').value = '';
    document.getElementById('clipTitleInput').value = '';
    document.getElementById('clipNoteInput').value = '';
    document.getElementById('voiceNoteBase64Input').value = '';
    const visualInput = document.getElementById('aiVisualUrlInput');
    if (visualInput) visualInput.value = '';
    const visualBox = document.getElementById('aiVisualPreviewContainer');
    if (visualBox) visualBox.style.display = 'none';
    document.getElementById('voicePreviewBox').style.display = 'none';
    resetVoiceRecordButtonUI();
    const durationPill = document.getElementById('durationPreviewPill');
    if (durationPill) durationPill.style.display = 'none';
    closeBookmarkDrawer();

    showToast(`Saved "${title}"! Cloud synced. 🎉`, 'success');
  });

  // 7. Video Speed Controller
  const speedButtons = document.querySelectorAll('.speed-btn');
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
        ytPlayer.setPlaybackRate(speed);
        showToast(`Speed set to ${speed}x`, 'info');
      }
    });
  });

  // 7.1. Play/Pause Toggle Button
  const playPauseToggleBtn = document.getElementById('playPauseToggleBtn');
  if (playPauseToggleBtn) {
    playPauseToggleBtn.addEventListener('click', () => {
      if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') {
        showToast('Load a video first!', 'error');
        return;
      }
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    });
  }

  // 7.2. Rewind & Forward 10s Buttons
  const rewind10Btn = document.getElementById('rewind10Btn');
  if (rewind10Btn) {
    rewind10Btn.addEventListener('click', () => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
      const cur = ytPlayer.getCurrentTime() || 0;
      ytPlayer.seekTo(Math.max(0, cur - 10), true);
      showToast('⏪ Rewound 10s', 'info');
    });
  }

  const forward10Btn = document.getElementById('forward10Btn');
  if (forward10Btn) {
    forward10Btn.addEventListener('click', () => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
      const cur = ytPlayer.getCurrentTime() || 0;
      ytPlayer.seekTo(cur + 10, true);
      showToast('⏩ Forwarded 10s', 'info');
    });
  }

  // 7.25. Floating Dock Minimize & ON/OFF Controls
  const minimizeFsDockBtn = document.getElementById('minimizeFsDockBtn');
  const expandFsDockBtn = document.getElementById('expandFsDockBtn');
  const fsDockExpanded = document.getElementById('fsDockExpanded');
  const floatingFsDock = document.getElementById('floatingFsDock');
  const dockOnOffToggleBtn = document.getElementById('dockOnOffToggleBtn');

  if (minimizeFsDockBtn && expandFsDockBtn && fsDockExpanded) {
    minimizeFsDockBtn.addEventListener('click', () => {
      fsDockExpanded.style.display = 'none';
      expandFsDockBtn.style.display = 'flex';
      showToast('⚡ Dock Minimized. Click ⚡ to reopen anytime.', 'info');
    });

    expandFsDockBtn.addEventListener('click', () => {
      fsDockExpanded.style.display = 'flex';
      expandFsDockBtn.style.display = 'none';
    });
  }

  if (dockOnOffToggleBtn && floatingFsDock) {
    dockOnOffToggleBtn.addEventListener('click', () => {
      floatingFsDock.classList.toggle('dock-hidden');
      const isHidden = floatingFsDock.classList.contains('dock-hidden');
      dockOnOffToggleBtn.textContent = isHidden ? '⚡ Dock: OFF' : '⚡ Dock: ON';
      dockOnOffToggleBtn.style.color = isHidden ? '#717171' : 'var(--yt-blue)';
      showToast(isHidden ? 'Floating Capture Dock Hidden' : 'Floating Capture Dock Active', 'info');
    });
  }

  // 7.3. Theater Mode Toggle
  const theaterModeBtn = document.getElementById('theaterModeBtn');
  if (theaterModeBtn) {
    theaterModeBtn.addEventListener('click', () => {
      const layoutGrid = document.querySelector('.layout-grid');
      layoutGrid.classList.toggle('theater-mode');
      const isTheater = layoutGrid.classList.contains('theater-mode');
      theaterModeBtn.classList.toggle('active-theater', isTheater);
      theaterModeBtn.innerHTML = isTheater ? '🔳 Normal View' : '🔲 Theater';
      showToast(isTheater ? '🔲 Theater Mode (Big Screen) Enabled' : 'Normal Grid View Restored', 'info');
    });
  }

  // 7.4. Fullscreen Button (Native Player Fullscreen)
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const playerWrapper = document.querySelector('.player-wrapper');
      if (!playerWrapper) return;

      if (!document.fullscreenElement) {
        if (playerWrapper.requestFullscreen) {
          playerWrapper.requestFullscreen();
        } else if (playerWrapper.webkitRequestFullscreen) {
          playerWrapper.webkitRequestFullscreen();
        } else if (playerWrapper.msRequestFullscreen) {
          playerWrapper.msRequestFullscreen();
        }
        showToast('⛶ Fullscreen Mode. Press ESC to exit.', 'info');
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  // 8. Auto-Stop Overlay Actions & Spaced Repetition Ratings
  const srHardBtn = document.getElementById('srHardBtn');
  if (srHardBtn) {
    srHardBtn.addEventListener('click', () => handleSpacedRepetitionRating('hard'));
  }

  const srGoodBtn = document.getElementById('srGoodBtn');
  if (srGoodBtn) {
    srGoodBtn.addEventListener('click', () => handleSpacedRepetitionRating('good'));
  }

  const srEasyBtn = document.getElementById('srEasyBtn');
  if (srEasyBtn) {
    srEasyBtn.addEventListener('click', () => handleSpacedRepetitionRating('easy'));
  }

  document.getElementById('replayClipBtn').addEventListener('click', () => {
    const overlay = document.getElementById('clipCompleteOverlay');
    overlay.classList.remove('active');
    if (appState.activePlayingClip && ytPlayer) {
      const clip = appState.clips.find(c => c.id === appState.activePlayingClip.clipId);
      if (clip) playSpecificClip(clip);
    }
  });

  document.getElementById('markDoneAndNextBtn').addEventListener('click', () => {
    if (appState.activePlayingClip) {
      const clip = appState.clips.find(c => c.id === appState.activePlayingClip.clipId);
      if (clip) {
        clip.mastered = true;
        saveStateToStorage(true);
        renderLibrary();
        showToast('Marked as Mastered! 🎉', 'success');
      }
    }
    dismissClipOverlay();
  });

  document.getElementById('continueVideoBtn').addEventListener('click', () => {
    dismissClipOverlay();
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      ytPlayer.playVideo();
    }
  });

  // 9. Tag & Chapter Filter Bar
  const chapterFilterSelect = document.getElementById('chapterFilterSelect');
  if (chapterFilterSelect) {
    chapterFilterSelect.addEventListener('change', (e) => {
      appState.activeFilterChapter = e.target.value;
      renderLibrary();
    });
  }

  const tagFilterSelect = document.getElementById('tagFilterSelect');
  if (tagFilterSelect) {
    tagFilterSelect.addEventListener('change', (e) => {
      appState.activeFilterTag = e.target.value;
      renderLibrary();
    });
  }

  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      appState.activeFilterSubject = 'all';
      appState.activeFilterChapter = 'all';
      appState.activeFilterTag = 'all';
      appState.searchQuery = '';
      const topSearchInput = document.getElementById('youtubeUrlInput');
      if (topSearchInput) topSearchInput.value = '';
      if (chapterFilterSelect) chapterFilterSelect.value = 'all';
      if (tagFilterSelect) tagFilterSelect.value = 'all';
      renderSubjectFilterTabs();
      renderChapterDropdowns();
      renderLibrary();
      showToast('Filters reset.', 'info');
    });
  }

  // 10. Demo Data & Backup
  const loadDemoBtn = document.getElementById('loadDemoBtn');
  if (loadDemoBtn) loadDemoBtn.addEventListener('click', () => loadSampleData(true));
  
  const loadDemoStateBtn = document.getElementById('loadDemoStateBtn');
  if (loadDemoStateBtn) loadDemoStateBtn.addEventListener('click', () => loadSampleData(true));
  
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportBackupJSON);
  
  const importInput = document.getElementById('importInput');
  if (importInput) importInput.addEventListener('change', importBackupJSON);

  // 11. Edit Modal Actions
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
  
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
  
  const editClipForm = document.getElementById('editClipForm');
  if (editClipForm) editClipForm.addEventListener('submit', handleSaveEditedClip);

  // 12. Firebase Cloud Modal Actions
  const openFirebaseModalBtn = document.getElementById('openFirebaseModalBtn');
  if (openFirebaseModalBtn) openFirebaseModalBtn.addEventListener('click', openFirebaseModal);
  
  const closeFirebaseModalBtn = document.getElementById('closeFirebaseModalBtn');
  if (closeFirebaseModalBtn) closeFirebaseModalBtn.addEventListener('click', closeFirebaseModal);
  
  const cancelFirebaseBtn = document.getElementById('cancelFirebaseBtn');
  if (cancelFirebaseBtn) cancelFirebaseBtn.addEventListener('click', closeFirebaseModal);
  
  const firebaseConfigForm = document.getElementById('firebaseConfigForm');
  if (firebaseConfigForm) firebaseConfigForm.addEventListener('submit', handleSaveFirebaseConfig);
  
  const disconnectFirebaseBtn = document.getElementById('disconnectFirebaseBtn');
  if (disconnectFirebaseBtn) {
    disconnectFirebaseBtn.addEventListener('click', () => {
      disconnectFirebase();
      closeFirebaseModal();
    });
  }
}

// ==========================================
// 9.5 Multi-Tier AI Smart Transcript & Revision Engine (TranscriptAPI + Groq + Gemini)
// ==========================================

async function fetchTranscriptFromTranscriptAPI(videoId) {
  if (!videoId) return null;
  if (appState.transcriptCache && appState.transcriptCache[videoId]) {
    return appState.transcriptCache[videoId];
  }

  const apiKey = appState.transcriptApiKey || DEFAULT_TRANSCRIPT_API_KEY;
  if (!apiKey) return null;

  const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!resp.ok) {
    throw new Error(`TranscriptAPI status: ${resp.status}`);
  }

  const data = await resp.json();
  const transcriptList = data?.transcript || [];
  if (transcriptList.length > 0) {
    if (!appState.transcriptCache) appState.transcriptCache = {};
    appState.transcriptCache[videoId] = transcriptList;
  }
  return transcriptList;
}

async function generateGeminiSmartNotes(prompt) {
  const apiKey = appState.geminiApiKey || DEFAULT_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 700
    }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errData = await resp.text();
    throw new Error(`Gemini API error (${resp.status}): ${errData}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content returned from Gemini.');
  return text.trim();
}

async function handleFetchTranscriptForTimeframe(isEditModal = false) {
  const startInput = document.getElementById(isEditModal ? 'editStartTimeInput' : 'startTimeInput');
  const endInput = document.getElementById(isEditModal ? 'editEndTimeInput' : 'endTimeInput');
  const titleInput = document.getElementById(isEditModal ? 'editTitleInput' : 'clipTitleInput');
  const subjectInput = document.getElementById(isEditModal ? 'editSubjectInput' : 'subjectSelect');
  const chapterInput = document.getElementById(isEditModal ? 'editChapterInput' : 'chapterSelect');
  const tagInput = document.getElementById(isEditModal ? 'editTagSelect' : 'tagSelect');
  const noteTextarea = document.getElementById(isEditModal ? 'editNoteInput' : 'clipNoteInput');
  const btn = document.getElementById(isEditModal ? 'editFetchTranscriptBtn' : 'fetchTranscriptBtn');
  const btnText = document.getElementById(isEditModal ? null : 'fetchTranscriptBtnText');

  let videoId = appState.currentVideoId;
  let videoTitle = appState.currentVideoTitle || 'Educational Lecture';

  if (isEditModal) {
    const clipId = document.getElementById('editClipId').value;
    const clip = appState.clips.find(c => c.id === clipId);
    if (clip) {
      if (clip.videoId) videoId = clip.videoId;
      if (clip.videoTitle) videoTitle = clip.videoTitle;
    }
  }

  if (!videoId) {
    showToast('Please load a YouTube video first!', 'error');
    return;
  }

  const startTimeStr = startInput && startInput.value ? startInput.value.trim() : '00:00:00';
  const endTimeStr = endInput && endInput.value ? endInput.value.trim() : '';
  const startSec = parseTimeToSeconds(startTimeStr);
  const endSec = endTimeStr ? parseTimeToSeconds(endTimeStr) : (startSec + 90);
  const topicTitle = titleInput && titleInput.value ? titleInput.value.trim() : '';
  const subject = subjectInput ? (subjectInput.value || '') : '';
  const chapter = chapterInput ? (chapterInput.value || '') : '';
  const tag = tagInput ? (tagInput.value || '') : '';

  if (btn) btn.classList.add('loading');
  if (btnText) btnText.textContent = '✨ Extracting...';
  showToast('Fetching exact timeframe transcript & AI notes... ⏳✨', 'info');

  let verbatimTranscript = '';
  let fetchedFromTranscriptAPI = false;
  let aiNotes = '';

  // Step 1: Try Secure Serverless Backend Proxy (/api/ai-notes) first
  try {
    const backendResp = await fetch('/api/ai-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        startTimeStr,
        endTimeStr,
        startSec,
        endSec,
        videoTitle,
        subject,
        chapter,
        topicTitle,
        tag
      })
    });

    if (backendResp.ok) {
      const bData = await backendResp.json();
      if (bData.verbatimTranscript) verbatimTranscript = bData.verbatimTranscript;
      if (bData.aiNotes) aiNotes = bData.aiNotes;
      if (bData.fetchedFromTranscriptAPI) fetchedFromTranscriptAPI = true;
    }
  } catch (bErr) {
    console.warn('Backend proxy attempt notice:', bErr.message);
  }

  // Step 2: Direct Fallback if backend was offline
  if (!verbatimTranscript) {
    try {
      const fullTranscript = await fetchTranscriptFromTranscriptAPI(videoId);
      if (fullTranscript && fullTranscript.length > 0) {
        const filtered = fullTranscript.filter(item => {
          const itemStart = typeof item.start === 'number' ? item.start : parseFloat(item.start || 0);
          return itemStart >= (startSec - 1.5) && (endSec ? itemStart <= (endSec + 1.5) : true);
        });

        if (filtered.length > 0) {
          verbatimTranscript = filtered.map(item => item.text.replace(/\[.*?\]/g, '').trim()).filter(Boolean).join(' ');
          fetchedFromTranscriptAPI = true;
        }
      }
    } catch (tErr) {
      console.warn('TranscriptAPI notice:', tErr.message);
    }
  }

  if (!aiNotes) {
    try {
      const transcriptContext = verbatimTranscript 
        ? `\n- Spoken Transcript in this timeframe: "${verbatimTranscript}"` 
        : '';

      const prompt = `You are an elite academic professor, Master Teacher, and top exam mentor for Indian competitive exam students (JEE Advanced, NEET-UG, CBSE Class 10/11/12, UPSC, Coding Interviews).
Your student is saving an essential lecture clip:
- Lecture Title: "${videoTitle}"
- YouTube URL: https://www.youtube.com/watch?v=${videoId}
- Timeframe: ${startTimeStr} to ${endTimeStr || formatSecondsToTime(endSec)}
- Subject: ${subject || 'General Science / Math / Coding'}
- Chapter: ${chapter || 'Important Chapter'}
- Topic / Question Title: "${topicTitle || 'Core Exam Concept'}"
- Category: "${tag || 'Key Concept'}"${transcriptContext}

CRITICAL INSTRUCTIONS:
- DO NOT write conversational greetings or filler (e.g. DO NOT say "Alright future toppers!", "Hello students", etc.).
- Start DIRECTLY with the structured notes.
- Write in razor-sharp, exam-focused Hinglish/English.

🎓 1. MASTER TEACHER'S CONCEPTUAL BREAKDOWN:
• (Concise point on core intuition)
• (Key concept explained step-by-step)

⚡ 2. TOPPER'S SECRET SHORTCUT & TRICK:
• (Speed calculation trick / mnemonic)

⚠️ 3. EXAM TRAP ALERT:
• (Common trap / negative marking trap to avoid)

📐 4. MUST-REMEMBER FORMULAS & DEFINITIONS:
• (Exact equations, formulas, or law)`;

      aiNotes = await generateGeminiSmartNotes(prompt);
    } catch (gErr) {
      console.warn('Gemini AI notice:', gErr.message);
    }
  }

  // Step 3: Combine output into note box
  if (verbatimTranscript || aiNotes) {
    let combinedNote = '';

    if (verbatimTranscript) {
      combinedNote += `📝 Spoken Transcript (${startTimeStr} - ${endTimeStr || formatSecondsToTime(endSec)}):\n"${verbatimTranscript}"\n\n---\n`;
    }

    if (aiNotes) {
      combinedNote += aiNotes;
    }

    if (noteTextarea) {
      if (noteTextarea.value.trim()) {
        noteTextarea.value = `${noteTextarea.value.trim()}\n\n---\n${combinedNote.trim()}`;
      } else {
        noteTextarea.value = combinedNote.trim();
      }
      noteTextarea.focus();
    }

    // Render ChatGPT-Style Rich Multimedia AI Flashcard
    const richBox = document.getElementById('richAiFlashcardBox');
    const richContent = document.getElementById('chatgptCardContent');
    if (richBox && richContent) {
      richContent.innerHTML = formatAiNotesToChatGPTCards(aiNotes, verbatimTranscript);
      richBox.style.display = 'block';
    }

    // Auto-generate 3D Visual Diagram for a complete Visual Flashcard
    const visualInput = document.getElementById('aiVisualUrlInput');
    if (!visualInput || !visualInput.value) {
      const topicContext = `${topicTitle || ''} ${verbatimTranscript.substring(0, 120)}`.trim();
      handleGenerateVisualCard(topicContext);
    }

    if (fetchedFromTranscriptAPI) {
      showToast('Exact Subtitles, AI Formulas & Visual Flashcard Generated! 🎯🎴', 'success');
    } else {
      showToast('Master Teacher Notes, Formulas & Visual Flashcard Generated! ✨🎴', 'success');
    }
  } else {
    showToast('Could not fetch transcript for this timeframe. Please check network connection.', 'error');
  }

  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = '✨ AI Master Notes';
}

function formatAiNotesToChatGPTCards(rawText, transcriptText) {
  let html = '';

  // 1. Spoken Transcript Quote
  if (transcriptText && transcriptText.trim()) {
    html += `
      <div class="cg-transcript-block">
        <div class="cg-transcript-title">📝 Spoken Verbatim Transcript:</div>
        <div class="cg-transcript-text">"${escapeHtml(transcriptText.trim())}"</div>
      </div>
    `;
  }

  if (!rawText) return html;

  // Process sections
  const lines = rawText.split('\n');
  let currentBlock = null;
  let blockContent = [];

  function flushBlock() {
    const text = blockContent.join('\n').trim();
    if (!text) return;

    if (currentBlock === 'teacher') {
      html += `
        <div class="cg-teacher-block">
          <div class="cg-teacher-title">🎓 Master Teacher Conceptual Breakdown</div>
          <div class="cg-bullet-list">${escapeHtml(text)}</div>
        </div>
      `;
    } else if (currentBlock === 'trick') {
      html += `
        <div class="cg-trick-block">
          <div class="cg-trick-title">⚡ Topper's Secret Shortcut & Trick</div>
          <div class="cg-bullet-list" style="color: #fef08a;">${escapeHtml(text)}</div>
        </div>
      `;
    } else if (currentBlock === 'trap') {
      html += `
        <div class="cg-trap-block">
          <div class="cg-trap-title">⚠️ Common Exam Trap Alert</div>
          <div class="cg-bullet-list" style="color: #fca5a5;">${escapeHtml(text)}</div>
        </div>
      `;
    } else if (currentBlock === 'formula') {
      html += `
        <div class="cg-formula-block">
          <div class="cg-formula-title">📐 Must-Remember Formulas & Core Laws</div>
          <div class="cg-bullet-list" style="color: #e9d5ff; font-weight: 600;">${escapeHtml(text)}</div>
        </div>
      `;
    }
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.includes('MASTER TEACHER') || trimmed.startsWith('1.')) {
      flushBlock();
      currentBlock = 'teacher';
      blockContent = [];
    } else if (trimmed.includes('TOPPER') || trimmed.includes('SHORTCUT') || trimmed.startsWith('2.')) {
      flushBlock();
      currentBlock = 'trick';
      blockContent = [];
    } else if (trimmed.includes('EXAM TRAP') || trimmed.startsWith('3.')) {
      flushBlock();
      currentBlock = 'trap';
      blockContent = [];
    } else if (trimmed.includes('FORMULA') || trimmed.includes('MUST-REMEMBER') || trimmed.startsWith('4.')) {
      flushBlock();
      currentBlock = 'formula';
      blockContent = [];
    } else if (trimmed) {
      blockContent.push(trimmed);
    }
  });
  flushBlock();

  if (!html) {
    html += `
      <div class="cg-teacher-block">
        <div class="cg-teacher-title">🎓 Master Revision Breakdown</div>
        <div class="cg-bullet-list">${escapeHtml(rawText)}</div>
      </div>
    `;
  }

  return html;
}

async function transcribeAudioBlobWithGroq(audioBlob) {
  // 1. Try secure backend serverless proxy first
  try {
    const reader = new FileReader();
    const base64Promise = new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(audioBlob);
    });
    const base64Audio = await base64Promise;

    const resp = await fetch('/api/transcribe-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Audio })
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data?.text) return data.text.trim();
    }
  } catch (bErr) {
    console.warn('Groq backend proxy notice:', bErr);
  }

  // 2. Direct Fallback if running standalone
  const apiKey = appState.groqApiKey || DEFAULT_GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voicenote.webm');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.text ? data.text.trim() : null;
  } catch (err) {
    console.warn('Groq Whisper direct notice:', err);
    return null;
  }
}

async function handleGenerateVisualCard(customTopic) {
  const title = customTopic || document.getElementById('clipTitleInput').value.trim() || appState.currentVideoTitle || 'Science Educational Concept';
  const subject = document.getElementById('subjectSelect').value || 'Physics';
  const btn = document.getElementById('genVisualCardBtn');
  const box = document.getElementById('richAiFlashcardBox');
  const banner = document.getElementById('chatgptCardBanner');
  const img = document.getElementById('chatgptCardImg');
  const input = document.getElementById('aiVisualUrlInput');

  if (btn) btn.innerHTML = '<span>🎨 Drawing 3D Art...</span>';
  showToast('Generating 3D Concept Diagram for Flashcard... 🎨✨', 'info');

  try {
    const cleanTopic = title.replace(/[^\w\s]/gi, ' ').substring(0, 80).trim();
    const cleanPrompt = encodeURIComponent(`accurate 3D educational concept illustration diagram of ${cleanTopic}, subject: ${subject}, science textbook ray diagram, clear lighting, crisp details, 8k render`);
    const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=460&nologo=true&seed=${Date.now()}`;

    // Preload image
    const tempImg = new Image();
    tempImg.onload = () => {
      if (img && banner && input) {
        img.src = tempImg.src;
        input.value = tempImg.src;
        banner.style.display = 'block';
        if (box) box.style.display = 'block';
      }
      if (btn) btn.innerHTML = '<span>🎨 AI Visual</span>';
      showToast('🎨 3D Concept Visual Ready! ✨', 'success');
    };

    tempImg.onerror = () => {
      const fallbackUrl = `https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80`;
      if (img && banner && input) {
        img.src = fallbackUrl;
        input.value = fallbackUrl;
        banner.style.display = 'block';
        if (box) box.style.display = 'block';
      }
      if (btn) btn.innerHTML = '<span>🎨 AI Visual</span>';
    };

    tempImg.src = imageUrl;

  } catch (err) {
    if (btn) btn.innerHTML = '<span>🎨 AI Visual</span>';
  }
}

function readOutNoteWithTTS(text) {
  if (!text || !('speechSynthesis' in window)) {
    showToast('Speech synthesis not supported on this browser.', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[^\w\s.,?!+-/*=]/gi, ' ');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
  showToast('🔊 Reading note aloud...', 'info');
}

function updateDurationPreview() {
  const startStr = document.getElementById('startTimeInput').value;
  const endStr = document.getElementById('endTimeInput').value;
  const pill = document.getElementById('durationPreviewPill');
  const rangeText = document.getElementById('durationRangeText');
  const totalText = document.getElementById('durationTotalText');

  if (startStr && endStr) {
    const startSec = parseTimeToSeconds(startStr);
    const endSec = parseTimeToSeconds(endStr);
    if (endSec > startSec) {
      pill.style.display = 'flex';
      rangeText.textContent = `${startStr} - ${endStr}`;
      totalText.textContent = formatDurationDiff(startSec, endSec);
      return;
    }
  }
  pill.style.display = 'none';
}

// ==========================================
// 10. Firebase Modal Logic
// ==========================================

function openFirebaseModal() {
  const modal = document.getElementById('firebaseModalBackdrop');
  const configInput = document.getElementById('firebaseConfigInput');
  const userIdInput = document.getElementById('firebaseUserIdInput');

  if (appState.firebaseConfig) {
    configInput.value = JSON.stringify(appState.firebaseConfig, null, 2);
  }
  userIdInput.value = appState.firebaseUserId || 'default_student';

  modal.classList.add('active');
}

function closeFirebaseModal() {
  document.getElementById('firebaseModalBackdrop').classList.remove('active');
}

function handleSaveFirebaseConfig(e) {
  e.preventDefault();
  const rawConfig = document.getElementById('firebaseConfigInput').value.trim();
  const userId = document.getElementById('firebaseUserIdInput').value.trim() || 'default_student';

  if (!rawConfig) {
    showToast('Please paste your Firebase config.', 'error');
    return;
  }

  try {
    // Attempt parse (handles standard JSON or JS object syntax)
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(rawConfig);
    } catch {
      // Evaluate safe JS object literal
      parsedConfig = (new Function(`return ${rawConfig}`))();
    }

    if (!parsedConfig || !parsedConfig.projectId) {
      showToast('Invalid Firebase config object. projectId is required.', 'error');
      return;
    }

    appState.firebaseConfig = parsedConfig;
    appState.firebaseUserId = userId;

    localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(parsedConfig));
    localStorage.setItem(STORAGE_KEYS.FIREBASE_USER_ID, userId);

    initFirebase();
    closeFirebaseModal();
  } catch (err) {
    showToast('Could not parse Firebase config. Please check format.', 'error');
  }
}

// ==========================================
// 11. Edit Modal Logic
// ==========================================

function openEditModal(clip) {
  const modal = document.getElementById('editModalBackdrop');
  document.getElementById('editClipId').value = clip.id;
  document.getElementById('editTitleInput').value = clip.title;
  document.getElementById('editStartTimeInput').value = clip.startTime;
  document.getElementById('editEndTimeInput').value = clip.endTime || '';
  document.getElementById('editSubjectInput').value = clip.subject;
  document.getElementById('editChapterInput').value = clip.chapter;
  document.getElementById('editTagSelect').value = clip.tag || 'Tricky Question';
  document.getElementById('editNoteInput').value = clip.note || '';

  modal.classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModalBackdrop').classList.remove('active');
}

function handleSaveEditedClip(e) {
  e.preventDefault();
  const id = document.getElementById('editClipId').value;
  const clip = appState.clips.find(c => c.id === id);
  if (!clip) return;

  const startStr = document.getElementById('editStartTimeInput').value.trim();
  const endStr = document.getElementById('editEndTimeInput').value.trim();
  const subject = document.getElementById('editSubjectInput').value.trim();
  const chapter = document.getElementById('editChapterInput').value.trim();

  clip.title = document.getElementById('editTitleInput').value.trim();
  clip.startTime = startStr;
  clip.startSeconds = parseTimeToSeconds(startStr);
  clip.endTime = endStr || null;
  clip.endSeconds = endStr ? parseTimeToSeconds(endStr) : null;
  clip.subject = subject;
  clip.chapter = chapter;
  clip.tag = document.getElementById('editTagSelect').value;
  clip.note = document.getElementById('editNoteInput').value.trim();

  if (!appState.subjects.includes(subject)) {
    appState.subjects.push(subject);
    appState.chapters[subject] = [];
  }
  if (!appState.chapters[subject].includes(chapter)) {
    appState.chapters[subject].push(chapter);
  }

  saveStateToStorage(true);
  renderSubjectDropdowns();
  renderSubjectFilterTabs();
  renderLibrary();
  closeEditModal();
  showToast('Clip updated & synced!', 'success');
}

// ==========================================
// 12. Backup Export & Import (JSON)
// ==========================================

function exportBackupJSON() {
  const data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    clips: appState.clips,
    subjects: appState.subjects,
    chapters: appState.chapters
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `RivisionTube_Backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  showToast('Backup JSON downloaded!', 'success');
}

function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (Array.isArray(data.clips)) {
        appState.clips = data.clips;
        if (Array.isArray(data.subjects)) appState.subjects = data.subjects;
        if (data.chapters) appState.chapters = data.chapters;

        saveStateToStorage(true);
        renderSubjectDropdowns();
        renderChapterDropdowns();
        renderSubjectFilterTabs();
        renderLibrary();
        showToast(`Imported ${data.clips.length} revision clips!`, 'success');
      } else {
        showToast('Invalid backup file format.', 'error');
      }
    } catch (err) {
      showToast('Error parsing JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 13. Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '💡';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Boot Application
document.addEventListener('DOMContentLoaded', initApp);
