(function () {
  'use strict';

  /* ========================================================================
     1. SISTEMA DE SONIDO SINTETIZADO CON DESBLOQUEO PARA iOS SAFARI / ANDROID
     ======================================================================== */
  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.isUnlocked = false;
    }

    unlockAudio() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.isUnlocked && this.ctx) {
        try {
          const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
          const source = this.ctx.createBufferSource();
          source.buffer = silentBuffer;
          source.connect(this.ctx.destination);
          source.start(0);
          this.isUnlocked = true;
        } catch (_) {}
      }
    }

    strikeBoxingBell(startTimeOffset = 0, intensity = 1.0, decaySeconds = 2.4) {
      if (this.isMuted) return;
      this.unlockAudio();
      if (!this.ctx) return;

      const now = this.ctx.currentTime + startTimeOffset;

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.58 * intensity, now);
      masterGain.connect(this.ctx.destination);

      const partials = [
        { freq: 415,  amp: 0.45, decay: decaySeconds * 1.00, type: 'sine' },
        { freq: 830,  amp: 0.95, decay: decaySeconds * 0.90, type: 'triangle' },
        { freq: 1188, amp: 0.65, decay: decaySeconds * 0.65, type: 'sine' },
        { freq: 1660, amp: 0.55, decay: decaySeconds * 0.50, type: 'sine' },
        { freq: 2295, amp: 0.40, decay: decaySeconds * 0.35, type: 'sine' },
        { freq: 3120, amp: 0.30, decay: decaySeconds * 0.22, type: 'triangle' },
        { freq: 4280, amp: 0.20, decay: decaySeconds * 0.12, type: 'sine' }
      ];

      partials.forEach((p) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = p.type;
        osc.frequency.setValueAtTime(p.freq, now);

        if (p.freq === 830 || p.freq === 1188) {
          const lfo = this.ctx.createOscillator();
          const lfoGain = this.ctx.createGain();
          lfo.frequency.setValueAtTime(6.5, now);
          lfoGain.gain.setValueAtTime(3.5, now);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start(now);
          lfo.stop(now + p.decay);
        }

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(p.amp, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + p.decay + 0.03);
      });

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.035);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2600, now);
      bandpass.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6 * intensity, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);

      whiteNoise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(masterGain);

      whiteNoise.start(now);
    }

    playCountdownBeep() {
      if (this.isMuted) return;
      this.unlockAudio();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.42, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    }

    playWorkStartBell() {
      this.strikeBoxingBell(0, 1.0, 2.6);
    }

    playRestStartBell() {
      this.strikeBoxingBell(0.00, 0.95, 1.8);
      this.strikeBoxingBell(0.26, 1.00, 2.5);
    }

    playFinishBellFanfare() {
      this.strikeBoxingBell(0.00, 0.90, 1.6);
      this.strikeBoxingBell(0.24, 0.95, 1.8);
      this.strikeBoxingBell(0.48, 1.05, 3.0);
    }
  }

  /* ========================================================================
     2. MAPA DE SEGMENTOS PARA EL DISPLAY DE 7 SEGMENTOS REAL
     ======================================================================== */
  const DIGIT_SEGMENTS_MAP = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'g', 'c', 'd'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g']
  };

  /* ========================================================================
     3. DEFINICIÓN DE FASES (PALETA TITANIUM CENTER), PRESETS Y ESTADO
     ======================================================================== */
  const PHASES = {
    PREP: 'PREP',
    WORK: 'WORK',
    REST_SHORT: 'REST_SHORT',
    REST_LONG: 'REST_LONG',
    DONE: 'DONE'
  };

  const PHASE_THEMES = {
    [PHASES.PREP]: {
      title: 'PREPARACIÓN',
      color: '#FFB300', /* Naranja / Ámbar Metálico */
      glow: 'rgba(255, 179, 0, 0.45)',
      glowStrong: 'rgba(255, 179, 0, 0.88)',
      bgTint: 'rgba(255, 179, 0, 0.06)'
    },
    [PHASES.WORK]: {
      title: '¡TRABAJO!',
      color: '#00E676', /* Verde Neón Intenso */
      glow: 'rgba(0, 230, 118, 0.45)',
      glowStrong: 'rgba(0, 230, 118, 0.88)',
      bgTint: 'rgba(0, 230, 118, 0.07)'
    },
    [PHASES.REST_SHORT]: {
      title: 'DESCANSO',
      color: '#E50914', /* Rojo Carmesí Intenso TITANIUM */
      glow: 'rgba(229, 9, 20, 0.5)',
      glowStrong: 'rgba(255, 36, 48, 0.92)',
      bgTint: 'rgba(229, 9, 20, 0.08)'
    },
    [PHASES.REST_LONG]: {
      title: 'DESCANSO DE RONDA',
      color: '#00E5FF', /* Azul / Cian Titanio */
      glow: 'rgba(0, 229, 255, 0.45)',
      glowStrong: 'rgba(0, 229, 255, 0.88)',
      bgTint: 'rgba(0, 229, 255, 0.06)'
    },
    [PHASES.DONE]: {
      title: '¡SESIÓN COMPLETADA!',
      color: '#00E676',
      glow: 'rgba(0, 230, 118, 0.5)',
      glowStrong: 'rgba(0, 230, 118, 0.9)',
      bgTint: 'rgba(0, 230, 118, 0.08)'
    }
  };

  const PRESETS = {
    gym: {
      prepSec: 10,
      workSec: 45,
      restShortSec: 60,
      setsPerRound: 4,
      restLongSec: 90,
      totalRounds: 3
    },
    crossfit: {
      prepSec: 10,
      workSec: 40,
      restShortSec: 20,
      setsPerRound: 8,
      restLongSec: 60,
      totalRounds: 2
    },
    boxing: {
      prepSec: 10,
      workSec: 180,
      restShortSec: 60,
      setsPerRound: 1,
      restLongSec: 60,
      totalRounds: 5
    }
  };

  const STORAGE_KEY = 'pro_gym_timer_config_v2';
  let config = { ...PRESETS.gym };

  let state = {
    phase: PHASES.PREP,
    currentSet: 1,
    currentRound: 1,
    phaseDurationMs: 10000,
    remainingMs: 10000,
    isRunning: false,
    isPaused: false,
    lastTickTimestamp: 0,
    lastAnnouncedSecond: null,
    rafId: null
  };

  const sound = new SoundSynthesizer();
  let wakeLockSentinel = null;

  /* ========================================================================
     4. REFERENCIAS AL DOM
     ======================================================================== */
  const dom = {
    appContainer: document.getElementById('appContainer'),
    configPanel: document.getElementById('configPanel'),
    panelBackdrop: document.getElementById('panelBackdrop'),
    btnTogglePanel: document.getElementById('btnTogglePanel'),
    togglePanelText: document.getElementById('togglePanelText'),
    btnCloseMobilePanel: document.getElementById('btnCloseMobilePanel'),

    prepMin: document.getElementById('prepMin'),
    prepSec: document.getElementById('prepSec'),
    workMin: document.getElementById('workMin'),
    workSec: document.getElementById('workSec'),
    restShortMin: document.getElementById('restShortMin'),
    restShortSec: document.getElementById('restShortSec'),
    setsPerRound: document.getElementById('setsPerRound'),
    restLongMin: document.getElementById('restLongMin'),
    restLongSec: document.getElementById('restLongSec'),
    totalRounds: document.getElementById('totalRounds'),
    totalSessionTime: document.getElementById('totalSessionTime'),
    btnSaveConfig: document.getElementById('btnSaveConfig'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    stepBtns: document.querySelectorAll('.step-btn[data-step-target]'),

    phaseLabel: document.getElementById('phaseLabel'),
    ledClockWrapper: document.getElementById('ledClockWrapper'),
    digitElements: document.querySelectorAll('.seg-digit'),
    clockDisplay: document.getElementById('clockDisplay'),
    progressBar: document.getElementById('progressBar'),
    nextPhaseLabel: document.getElementById('nextPhaseLabel'),
    progressPercent: document.getElementById('progressPercent'),
    currentSetDisplay: document.getElementById('currentSetDisplay'),
    totalSetsDisplay: document.getElementById('totalSetsDisplay'),
    currentRoundDisplay: document.getElementById('currentRoundDisplay'),
    totalRoundsDisplay: document.getElementById('totalRoundsDisplay'),

    btnStartResume: document.getElementById('btnStartResume'),
    startBtnText: document.getElementById('startBtnText'),
    btnPause: document.getElementById('btnPause'),
    btnReset: document.getElementById('btnReset'),
    btnSkipPhase: document.getElementById('btnSkipPhase'),
    btnMute: document.getElementById('btnMute'),
    iconSoundOn: document.getElementById('iconSoundOn'),
    iconSoundOff: document.getElementById('iconSoundOff'),
    muteText: document.getElementById('muteText'),
    wakeLockBadge: document.getElementById('wakeLockBadge'),
    wakeLockText: document.getElementById('wakeLockText')
  };

  /* ========================================================================
     5. UTILIDADES DE FORMATO Y ACTUALIZACIÓN DE 7 SEGMENTOS
     ======================================================================== */
  function formatMMSS(totalSeconds) {
    const clamped = Math.max(0, Math.ceil(totalSeconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function updateSevenSegmentClock(mmssString) {
    const digitsOnly = mmssString.replace(':', '');
    dom.digitElements.forEach((digitEl, index) => {
      const char = digitsOnly[index] || '0';
      const activeSegments = DIGIT_SEGMENTS_MAP[char] || DIGIT_SEGMENTS_MAP['0'];

      const allSegs = digitEl.querySelectorAll('.seg');
      allSegs.forEach((segEl) => {
        const isSegOn = activeSegments.some((code) => segEl.classList.contains(`seg-${code}`));
        if (isSegOn) {
          segEl.classList.add('on');
        } else {
          segEl.classList.remove('on');
        }
      });
    });

    if (dom.clockDisplay) {
      dom.clockDisplay.textContent = mmssString;
    }
    if (dom.ledClockWrapper) {
      dom.ledClockWrapper.setAttribute('aria-label', mmssString);
    }
  }

  function clampInt(val, min, max, fallback = min) {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function calculateTotalSessionSeconds(cfg) {
    const workPerRound = cfg.setsPerRound * cfg.workSec;
    const shortRestPerRound = Math.max(0, cfg.setsPerRound - 1) * cfg.restShortSec;
    const allRoundsTime = cfg.totalRounds * (workPerRound + shortRestPerRound);
    const allLongRests = Math.max(0, cfg.totalRounds - 1) * cfg.restLongSec;
    return cfg.prepSec + allRoundsTime + allLongRests;
  }

  /* ========================================================================
     6. GESTIÓN DE SCREEN WAKE LOCK API + RE-ADQUISICIÓN AUTOMÁTICA
     ======================================================================== */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      dom.wakeLockText.textContent = 'Wake Lock N/D';
      return;
    }
    try {
      if (wakeLockSentinel) return;
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      dom.wakeLockBadge.classList.add('active');
      dom.wakeLockText.textContent = 'Pantalla Activa: ON';

      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
        dom.wakeLockBadge.classList.remove('active');
        dom.wakeLockText.textContent = 'Pantalla Activa';
      });
    } catch (_) {
      dom.wakeLockBadge.classList.remove('active');
      dom.wakeLockText.textContent = 'Pantalla Activa';
    }
  }

  async function releaseWakeLock() {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      } catch (_) {}
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.isRunning) {
      requestWakeLock();
      sound.unlockAudio();
    }
  });

  window.addEventListener('focus', () => {
    if (state.isRunning) {
      requestWakeLock();
    }
  });

  /* ========================================================================
     7. SINCRONIZACIÓN DE CONFIGURACIÓN Y UI
     ======================================================================== */
  function populateInputsFromConfig(cfg) {
    dom.prepMin.value = Math.floor(cfg.prepSec / 60);
    dom.prepSec.value = cfg.prepSec % 60;

    dom.workMin.value = Math.floor(cfg.workSec / 60);
    dom.workSec.value = cfg.workSec % 60;

    dom.restShortMin.value = Math.floor(cfg.restShortSec / 60);
    dom.restShortSec.value = cfg.restShortSec % 60;

    dom.setsPerRound.value = cfg.setsPerRound;

    dom.restLongMin.value = Math.floor(cfg.restLongSec / 60);
    dom.restLongSec.value = cfg.restLongSec % 60;

    dom.totalRounds.value = cfg.totalRounds;

    updateEstimatedTotalUI(cfg);
  }

  function readConfigFromInputs() {
    const prepSec = clampInt(dom.prepMin.value, 0, 59, 0) * 60 + clampInt(dom.prepSec.value, 0, 59, 0);
    const workSec = Math.max(1, clampInt(dom.workMin.value, 0, 59, 0) * 60 + clampInt(dom.workSec.value, 0, 59, 45));
    const restShortSec = clampInt(dom.restShortMin.value, 0, 59, 0) * 60 + clampInt(dom.restShortSec.value, 0, 59, 0);
    const setsPerRound = clampInt(dom.setsPerRound.value, 1, 99, 4);
    const restLongSec = clampInt(dom.restLongMin.value, 0, 59, 0) * 60 + clampInt(dom.restLongSec.value, 0, 59, 0);
    const totalRounds = clampInt(dom.totalRounds.value, 1, 99, 3);

    return {
      prepSec,
      workSec,
      restShortSec,
      setsPerRound,
      restLongSec,
      totalRounds
    };
  }

  function updateEstimatedTotalUI(cfg) {
    const totalSecs = calculateTotalSessionSeconds(cfg);
    dom.totalSessionTime.textContent = formatMMSS(totalSecs);
  }

  function saveConfigToStorage(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }

  function loadConfigFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.workSec === 'number') {
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  /* ========================================================================
     8. MOTOR DE FASES Y TRANSICIONES DEL TEMPORIZADOR
     ======================================================================== */
  function applyPhaseTheme(phase) {
    const theme = PHASE_THEMES[phase] || PHASE_THEMES[PHASES.PREP];
    const root = document.documentElement;
    root.style.setProperty('--active-color', theme.color);
    root.style.setProperty('--active-glow', theme.glow);
    root.style.setProperty('--active-glow-strong', theme.glowStrong);
    root.style.setProperty('--active-bg-tint', theme.bgTint);
    dom.phaseLabel.textContent = theme.title;
  }

  function getNextPhaseDescription() {
    if (state.phase === PHASES.DONE) {
      return 'ENTRENAMIENTO FINALIZADO';
    }
    if (state.phase === PHASES.PREP) {
      return `SIGUIENTE: TRABAJO (${formatMMSS(config.workSec)})`;
    }
    if (state.phase === PHASES.WORK) {
      if (state.currentSet < config.setsPerRound) {
        if (config.restShortSec > 0) {
          return `SIGUIENTE: DESCANSO (${formatMMSS(config.restShortSec)})`;
        }
        return `SIGUIENTE: SERIE ${state.currentSet + 1} (${formatMMSS(config.workSec)})`;
      }
      if (state.currentRound < config.totalRounds) {
        if (config.restLongSec > 0) {
          return `SIGUIENTE: DESCANSO RONDA (${formatMMSS(config.restLongSec)})`;
        }
        return `SIGUIENTE: RONDA ${state.currentRound + 1} (${formatMMSS(config.workSec)})`;
      }
      return 'SIGUIENTE: FINAL DE SESIÓN';
    }
    if (state.phase === PHASES.REST_SHORT) {
      return `SIGUIENTE: SERIE ${state.currentSet + 1} (${formatMMSS(config.workSec)})`;
    }
    if (state.phase === PHASES.REST_LONG) {
      return `SIGUIENTE: RONDA ${state.currentRound + 1} (${formatMMSS(config.workSec)})`;
    }
    return '';
  }

  function enterPhase(phase, durationSeconds, playPhaseSound = true) {
    state.phase = phase;
    state.phaseDurationMs = Math.max(0, durationSeconds * 1000);
    state.remainingMs = state.phaseDurationMs;
    state.lastAnnouncedSecond = null;

    applyPhaseTheme(phase);

    if (playPhaseSound) {
      if (phase === PHASES.WORK) {
        sound.playWorkStartBell();
      } else if (phase === PHASES.REST_SHORT || phase === PHASES.REST_LONG) {
        sound.playRestStartBell();
      } else if (phase === PHASES.DONE) {
        sound.playFinishBellFanfare();
      }
    }

    renderDisplay();
  }

  function advanceToNextPhase() {
    if (state.phase === PHASES.PREP) {
      enterPhase(PHASES.WORK, config.workSec, true);
      return;
    }

    if (state.phase === PHASES.WORK) {
      if (state.currentSet < config.setsPerRound) {
        if (config.restShortSec > 0) {
          enterPhase(PHASES.REST_SHORT, config.restShortSec, true);
        } else {
          state.currentSet += 1;
          enterPhase(PHASES.WORK, config.workSec, true);
        }
        return;
      }

      if (state.currentRound < config.totalRounds) {
        if (config.restLongSec > 0) {
          enterPhase(PHASES.REST_LONG, config.restLongSec, true);
        } else {
          state.currentRound += 1;
          state.currentSet = 1;
          enterPhase(PHASES.WORK, config.workSec, true);
        }
        return;
      }

      completeWorkoutSession();
      return;
    }

    if (state.phase === PHASES.REST_SHORT) {
      state.currentSet += 1;
      enterPhase(PHASES.WORK, config.workSec, true);
      return;
    }

    if (state.phase === PHASES.REST_LONG) {
      state.currentRound += 1;
      state.currentSet = 1;
      enterPhase(PHASES.WORK, config.workSec, true);
      return;
    }
  }

  function completeWorkoutSession() {
    state.isRunning = false;
    state.isPaused = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    releaseWakeLock();
    enterPhase(PHASES.DONE, 0, true);
    updateControlButtonsUI();
  }

  /* ========================================================================
     9. BUCLE DE TIEMPO DE ALTA PRECISIÓN (requestAnimationFrame + performance.now)
     ======================================================================== */
  function tick(now) {
    if (!state.isRunning) return;

    const deltaMs = now - state.lastTickTimestamp;
    state.lastTickTimestamp = now;

    state.remainingMs = Math.max(0, state.remainingMs - deltaMs);
    const secondsLeftCeil = Math.ceil(state.remainingMs / 1000);

    if (secondsLeftCeil >= 1 && secondsLeftCeil <= 3 && state.lastAnnouncedSecond !== secondsLeftCeil) {
      state.lastAnnouncedSecond = secondsLeftCeil;
      sound.playCountdownBeep();
    }

    renderDisplay();

    if (state.remainingMs <= 0) {
      advanceToNextPhase();
      if (state.isRunning) {
        state.lastTickTimestamp = performance.now();
        state.rafId = requestAnimationFrame(tick);
      }
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  /* ========================================================================
     10. RENDERIZADO DEL DISPLAY 7-SEGMENTOS Y CONTROLES
     ======================================================================== */
  function renderDisplay() {
    const secondsLeft = Math.ceil(state.remainingMs / 1000);
    const formatted = formatMMSS(secondsLeft);

    updateSevenSegmentClock(formatted);

    if (state.isRunning && secondsLeft >= 1 && secondsLeft <= 3) {
      dom.ledClockWrapper.classList.add('countdown-warning');
    } else {
      dom.ledClockWrapper.classList.remove('countdown-warning');
    }

    let progressRatio = 0;
    if (state.phase === PHASES.DONE) {
      progressRatio = 1;
    } else if (state.phaseDurationMs > 0) {
      progressRatio = Math.max(0, Math.min(1, state.remainingMs / state.phaseDurationMs));
    }

    const percentFormatted = Math.round(progressRatio * 100);
    dom.progressBar.style.width = `${(progressRatio * 100).toFixed(2)}%`;
    dom.progressPercent.textContent = `${percentFormatted}%`;
    dom.nextPhaseLabel.textContent = getNextPhaseDescription();

    dom.currentSetDisplay.textContent = state.currentSet;
    dom.totalSetsDisplay.textContent = config.setsPerRound;
    dom.currentRoundDisplay.textContent = state.currentRound;
    dom.totalRoundsDisplay.textContent = config.totalRounds;
  }

  function updateControlButtonsUI() {
    if (state.isRunning) {
      dom.btnStartResume.classList.add('hidden');
      dom.btnPause.classList.remove('hidden');
    } else {
      dom.btnStartResume.classList.remove('hidden');
      dom.btnPause.classList.add('hidden');
      if (state.isPaused) {
        dom.startBtnText.textContent = 'Reanudar';
      } else if (state.phase === PHASES.DONE) {
        dom.startBtnText.textContent = 'Repetir';
      } else {
        dom.startBtnText.textContent = 'Iniciar';
      }
    }
  }

  /* ========================================================================
     11. ACCIONES DE USUARIO Y CONTROL DEL BOTTOM-SHEET MÓVIL
     ======================================================================== */
  function startOrResumeTimer() {
    sound.unlockAudio();

    const startingFresh = !state.isPaused && state.phase !== PHASES.DONE;

    if (state.phase === PHASES.DONE) {
      resetTimer();
    }

    if (startingFresh && state.phase === PHASES.WORK) {
      sound.playWorkStartBell();
    }

    state.isRunning = true;
    state.isPaused = false;
    state.lastTickTimestamp = performance.now();

    if (window.innerWidth <= 1024) {
      setPanelCollapsed(true);
    }

    requestWakeLock();
    updateControlButtonsUI();

    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }

  function pauseTimer() {
    if (!state.isRunning) return;
    state.isRunning = false;
    state.isPaused = true;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    dom.ledClockWrapper.classList.remove('countdown-warning');
    releaseWakeLock();
    updateControlButtonsUI();
  }

  function resetTimer() {
    state.isRunning = false;
    state.isPaused = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    releaseWakeLock();

    state.currentSet = 1;
    state.currentRound = 1;

    if (config.prepSec > 0) {
      enterPhase(PHASES.PREP, config.prepSec, false);
    } else {
      enterPhase(PHASES.WORK, config.workSec, false);
    }

    updateControlButtonsUI();
  }

  function skipCurrentPhase() {
    sound.unlockAudio();
    if (state.phase === PHASES.DONE) return;
    advanceToNextPhase();
    if (state.isRunning) {
      state.lastTickTimestamp = performance.now();
    }
  }

  function setPanelCollapsed(collapsed) {
    if (collapsed) {
      dom.appContainer.classList.add('panel-collapsed');
      dom.togglePanelText.textContent = 'Configurar';
    } else {
      dom.appContainer.classList.remove('panel-collapsed');
      dom.togglePanelText.textContent = 'Ocultar Config';
    }
  }

  function togglePanel() {
    const isCollapsed = dom.appContainer.classList.contains('panel-collapsed');
    setPanelCollapsed(!isCollapsed);
  }

  function toggleMute() {
    sound.unlockAudio();
    sound.isMuted = !sound.isMuted;
    if (sound.isMuted) {
      dom.btnMute.classList.add('muted');
      dom.iconSoundOn.classList.add('hidden');
      dom.iconSoundOff.classList.remove('hidden');
      dom.muteText.textContent = 'Campana OFF';
    } else {
      dom.btnMute.classList.remove('muted');
      dom.iconSoundOn.classList.remove('hidden');
      dom.iconSoundOff.classList.add('hidden');
      dom.muteText.textContent = 'Campana ON';
      sound.playWorkStartBell();
    }
  }

  /* ========================================================================
     12. EVENTOS TÁCTILES, DESBLOQUEO GLOBAL DE AUDIO Y SERVICE WORKER PWA
     ======================================================================== */
  function bindEvents() {
    const unlockOnFirstTouch = () => {
      sound.unlockAudio();
      window.removeEventListener('touchstart', unlockOnFirstTouch, true);
      window.removeEventListener('touchend', unlockOnFirstTouch, true);
      window.removeEventListener('click', unlockOnFirstTouch, true);
    };
    window.addEventListener('touchstart', unlockOnFirstTouch, { capture: true, passive: true });
    window.addEventListener('touchend', unlockOnFirstTouch, { capture: true, passive: true });
    window.addEventListener('click', unlockOnFirstTouch, { capture: true, passive: true });

    dom.btnStartResume.addEventListener('click', startOrResumeTimer);
    dom.btnPause.addEventListener('click', pauseTimer);
    dom.btnReset.addEventListener('click', resetTimer);
    dom.btnSkipPhase.addEventListener('click', skipCurrentPhase);

    dom.btnTogglePanel.addEventListener('click', togglePanel);
    dom.btnCloseMobilePanel.addEventListener('click', () => setPanelCollapsed(true));
    dom.panelBackdrop.addEventListener('click', () => setPanelCollapsed(true));

    dom.btnMute.addEventListener('click', toggleMute);

    dom.btnSaveConfig.addEventListener('click', () => {
      sound.unlockAudio();
      config = readConfigFromInputs();
      populateInputsFromConfig(config);
      saveConfigToStorage(config);
      dom.presetBtns.forEach(b => b.classList.remove('active'));
      resetTimer();

      const originalText = dom.btnSaveConfig.textContent;
      dom.btnSaveConfig.textContent = '¡Configuración Aplicada!';
      setTimeout(() => {
        dom.btnSaveConfig.textContent = originalText;
        if (window.innerWidth <= 1024) {
          setPanelCollapsed(true);
        }
      }, 700);
    });

    const allInputs = [
      dom.prepMin, dom.prepSec,
      dom.workMin, dom.workSec,
      dom.restShortMin, dom.restShortSec,
      dom.setsPerRound,
      dom.restLongMin, dom.restLongSec,
      dom.totalRounds
    ];
    allInputs.forEach(input => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', () => {
        const tempCfg = readConfigFromInputs();
        updateEstimatedTotalUI(tempCfg);
      });
    });

    dom.stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-step-target');
        const delta = parseInt(btn.getAttribute('data-step'), 10);
        const inputEl = document.getElementById(targetId);
        if (!inputEl) return;
        const nextVal = clampInt(inputEl.value, 1, 99, 1) + delta;
        inputEl.value = Math.min(99, Math.max(1, nextVal));
        updateEstimatedTotalUI(readConfigFromInputs());
      });
    });

    dom.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.unlockAudio();
        const key = btn.getAttribute('data-preset');
        const preset = PRESETS[key];
        if (!preset) return;

        dom.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        config = { ...preset };
        populateInputsFromConfig(config);
        saveConfigToStorage(config);
        resetTimer();
      });
    });

    let touchStartY = 0;
    const headerEl = dom.configPanel.querySelector('.panel-header');
    if (headerEl) {
      headerEl.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      headerEl.addEventListener('touchend', (e) => {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (deltaY > 45) {
          setPanelCollapsed(true);
        }
      }, { passive: true });
    }

    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (state.isRunning) {
          pauseTimer();
        } else {
          startOrResumeTimer();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        resetTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    });
  }

  function registerInlineServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      const swCode = `
        self.addEventListener('install', (e) => self.skipWaiting());
        self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
        self.addEventListener('fetch', (e) => {});
      `;
      try {
        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        navigator.serviceWorker.register(swUrl).catch(() => {});
      } catch (_) {}
    }
  }

  function initApp() {
    const saved = loadConfigFromStorage();
    if (saved) {
      config = { ...config, ...saved };
      dom.presetBtns.forEach(b => b.classList.remove('active'));
    }

    if (window.innerWidth <= 1024) {
      setPanelCollapsed(true);
    } else {
      setPanelCollapsed(false);
    }

    populateInputsFromConfig(config);
    bindEvents();
    resetTimer();
    registerInlineServiceWorker();
  }

  initApp();
})();
