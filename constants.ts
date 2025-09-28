import { Track, StepState, FilterType, KickParams, HatParams, PolyParams, BassParams, ModalParams, LFOParams, RiftParams, GrainParams, ScreamParams } from './types';

const STEPS = 16;

const createEmptySteps = (): StepState[] => Array(STEPS).fill(null).map(() => ({ 
    active: false, 
    pLocks: null,
    note: null,
    velocity: 1.0,
}));

const NEUTRAL_LFO: LFOParams = {
    waveform: 'triangle',
    rate: 1,
    depth: 0,
    destination: 'none',
};

const NEUTRAL_FILTER: FilterType = 'lowpass';

// --- Initial Instrument Parameters (Tuned for good default sound) ---

const INITIAL_KICK_PARAMS: KickParams = {
    tune: 40,
    decay: 0.45,
    punch: 70,
    saturation: 50,
    body: 50,
    tone: 8000,
    transientAmount: 50,
    pitchEnvAmount: 80,
    pitchEnvDecay: 0.1,
    rumbleAmount: 30,
    rumbleDecay: 0.8,
    rumbleTone: 400,
    filter: { type: NEUTRAL_FILTER, cutoff: 20000, resonance: 1 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
};

const INITIAL_HAT_PARAMS: HatParams = {
    tone: 9000,
    decay: 0.06,
    metal: 0.5,
    filter: { type: NEUTRAL_FILTER, cutoff: 20000, resonance: 1 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
};

const INITIAL_POLY_PARAMS: PolyParams = {
    osc1: { waveform: 'sawtooth', octave: 0, detune: -3 },
    osc2: { waveform: 'square', octave: 0, detune: 3 },
    oscMix: 50,
    noiseLevel: 0.02,
    filter: { type: 'lowpass', cutoff: 4000, resonance: 2 },
    ampEnv: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.2 },
    filterEnv: { attack: 0.02, decay: 0.4, sustain: 0, release: 0.4 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
};

const INITIAL_BASS_PARAMS: BassParams = {
    waveform: 'sawtooth',
    cutoff: 800,
    resonance: 7,
    decay: 0.3,
    accent: 50,
    filter: { type: NEUTRAL_FILTER, cutoff: 20000, resonance: 1 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
};

const INITIAL_MODAL_PARAMS: ModalParams = {
  structure: 25,
  brightness: 60,
  decay: 0.5,
  damping: 30,
  filter: { type: NEUTRAL_FILTER, cutoff: 20000, resonance: 1 },
  lfo1: NEUTRAL_LFO,
  lfo2: NEUTRAL_LFO,
};

const INITIAL_RIFT_PARAMS: RiftParams = {
    pitch: 0,
    fold: 30,
    drive: 20,
    feedback: 10,
    decay: 0.25,
    filter: { type: 'lowpass', cutoff: 6000, resonance: 5 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
}

const INITIAL_GRAIN_PARAMS: GrainParams = {
    pitch: 0,
    decay: 0.3,
    density: 50,
    spread: 20,
    grainSize: 30,
    filter: { type: 'lowpass', cutoff: 12000, resonance: 1 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
}

const INITIAL_SCREAM_PARAMS: ScreamParams = {
    pitch: 0,
    decay: 0.4,
    feedback: 80,
    damping: 5000,
    filter: { type: 'lowpass', cutoff: 15000, resonance: 1 },
    lfo1: NEUTRAL_LFO,
    lfo2: NEUTRAL_LFO,
}


export const INITIAL_TRACKS: Track[] = [
  {
    id: 0,
    name: 'Kick',
    type: 'kick',
    params: INITIAL_KICK_PARAMS,
    fxSends: { reverb: 0.1, delay: 0, drive: 0.2 },
    volume: 0.9,
    patternLength: 16,
    defaultNote: 'C2',
    steps: createEmptySteps(),
  },
  {
    id: 1,
    name: 'Hat',
    type: 'hat',
    params: INITIAL_HAT_PARAMS,
    fxSends: { reverb: 0.1, delay: 0.3, drive: 0 },
    volume: 0.6,
    patternLength: 16,
    defaultNote: 'C5',
    steps: createEmptySteps(),
  },
  {
    id: 2,
    name: 'Poly',
    type: 'poly',
    params: INITIAL_POLY_PARAMS,
    fxSends: { reverb: 0.4, delay: 0.5, drive: 0 },
    volume: 0.65,
    patternLength: 16,
    defaultNote: 'C4',
    steps: createEmptySteps(),
  },
  {
    id: 3,
    name: 'Bass',
    type: 'bass',
    params: INITIAL_BASS_PARAMS,
    fxSends: { reverb: 0, delay: 0, drive: 0.1 },
    volume: 0.8,
    patternLength: 16,
    defaultNote: 'C1',
    steps: createEmptySteps(),
  },
  {
    id: 4,
    name: 'Modal',
    type: 'modal',
    params: INITIAL_MODAL_PARAMS,
    fxSends: { reverb: 0.6, delay: 0.6, drive: 0 },
    volume: 1.4,
    patternLength: 16,
    defaultNote: 'C4',
    steps: createEmptySteps(),
  },
  {
    id: 5,
    name: 'Rift',
    type: 'rift',
    params: INITIAL_RIFT_PARAMS,
    fxSends: { reverb: 0.2, delay: 0.4, drive: 0.3 },
    volume: 0.7,
    patternLength: 16,
    defaultNote: 'C3',
    steps: createEmptySteps(),
  },
  {
    id: 6,
    name: 'Grain',
    type: 'grain',
    params: INITIAL_GRAIN_PARAMS,
    fxSends: { reverb: 0.5, delay: 0.5, drive: 0.1 },
    volume: 0.65,
    patternLength: 16,
    defaultNote: 'C4',
    steps: createEmptySteps(),
  },
  {
    id: 7,
    name: 'Scream',
    type: 'scream',
    params: INITIAL_SCREAM_PARAMS,
    fxSends: { reverb: 0.3, delay: 0.2, drive: 0.4 },
    volume: 0.65,
    patternLength: 16,
    defaultNote: 'C5',
    steps: createEmptySteps(),
  }
];

export const TIME_DIVISIONS = [
    { name: '1/64', value: 0.0625 },
    { name: '1/32', value: 0.125 },
    { name: '1/16', value: 0.25 },
    { name: '1/8', value: 0.5 },
    { name: '1/4', value: 1 },
    { name: '1/2', value: 2 },
    { name: '1 bar', value: 4 },
    { name: '1/16T', value: 0.25 * (2/3) },
    { name: '1/8T', value: 0.5 * (2/3) },
    { name: '1/4T', value: 1 * (2/3) },
    { name: '1/16D', value: 0.25 * 1.5 },
    { name: '1/8D', value: 0.75 },
    { name: '1/4D', value: 1.5 },
];
