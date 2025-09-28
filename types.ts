export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterParams {
  type: FilterType;
  cutoff: number;
  resonance: number;
}

export type LFOWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export type LFODestination = 
  | 'none' | 'pitch' | 'volume' 
  | 'filterCutoff' | 'filterResonance'
  // Kick
  | 'kickSaturation' | 'kickTransient' | 'kickPitchEnv'
  | 'kickBody' | 'kickTone'
  | 'kickRumbleAmt' | 'kickRumbleDecay' | 'kickRumbleTone'
  // Hat
  | 'hatTone' | 'hatMetal'
  // Bass
  | 'bassCutoff'
  // Poly
  | 'polyOscMix' | 'polyNoise'
  // Modal
  | 'modalStructure' | 'modalBrightness'
  // Rift
  | 'riftFold' | 'riftDrive' | 'riftFeedback'
  // Grain
  | 'grainPitch' | 'grainDensity' | 'grainSize'
  // Scream
  | 'screamFeedback' | 'screamDamping';


export interface LFOParams {
    waveform: LFOWaveform;
    rate: number;
    depth: number;
    destination: LFODestination;
}


// --- Instrument Parameter Types ---

export interface KickParams {
    tune: number;
    decay: number;
    punch: number;
    saturation: number;
    body: number;
    tone: number;
    transientAmount: number;
    pitchEnvAmount: number;
    pitchEnvDecay: number;
    rumbleAmount: number;
    rumbleDecay: number;
    rumbleTone: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface HatParams {
    tone: number;
    decay: number;
    metal: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface OscillatorParams {
  waveform: Waveform;
  octave: number;
  detune: number;
}

export interface PolyParams {
    osc1: OscillatorParams;
    osc2: OscillatorParams;
    oscMix: number;
    noiseLevel: number;
    filter: FilterParams;
    ampEnv: Envelope;
    filterEnv: Envelope;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface BassParams {
    waveform: Waveform;
    cutoff: number;
    resonance: number;
    decay: number;
    accent: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface ModalParams {
  structure: number;
  brightness: number;
  decay: number;
  damping: number;
  filter: FilterParams;
  lfo1: LFOParams;
  lfo2: LFOParams;
}

export interface RiftParams {
    pitch: number;
    fold: number;
    drive: number;
    feedback: number;
    decay: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface GrainParams {
    pitch: number;
    decay: number;
    density: number;
    spread: number;
    grainSize: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}

export interface ScreamParams {
    pitch: number;
    decay: number;
    feedback: number;
    damping: number;
    filter: FilterParams;
    lfo1: LFOParams;
    lfo2: LFOParams;
}


export interface FXSends {
  reverb: number;
  delay: number;
  drive: number;
}

export type AllInstrumentParams = KickParams | HatParams | PolyParams | BassParams | ModalParams | RiftParams | GrainParams | ScreamParams;

export type PLocks = {
  kickParams?: Partial<KickParams>;
  hatParams?: Partial<HatParams>;
  polyParams?: Partial<PolyParams>;
  bassParams?: Partial<BassParams>;
  modalParams?: Partial<ModalParams>;
  riftParams?: Partial<RiftParams>;
  grainParams?: Partial<GrainParams>;
  screamParams?: Partial<ScreamParams>;
  volume?: number;
  fxSends?: Partial<FXSends>;
};

export interface StepState {
  active: boolean;
  pLocks: PLocks | null;
  note: string | null;
  velocity: number; // 0 to 1
}

export type TrackType = 'kick' | 'hat' | 'poly' | 'bass' | 'modal' | 'rift' | 'grain' | 'scream';

export interface Track {
  id: number;
  name: string;
  type: TrackType;
  params: AllInstrumentParams;
  fxSends: FXSends;
  volume: number;
  patternLength: number;
  defaultNote: string;
  steps: StepState[];
}

export interface ReverbParams {
  decay: number;
  mix: number;
  preDelay: number;
  preDelaySync: boolean;
  preDelayDivision: number;
}

export interface DelayParams {
  time: number;
  feedback: number;
  mix: number;
  timeSync: boolean;
  timeDivision: number;
}

export interface DriveParams {
  amount: number;
  tone: number;
  mix: number;
}

export interface CompressorParams {
  threshold: number;
  ratio: number;
  knee: number;
  attack: number;
  release: number;
  makeup: number;
}

export interface GlobalFXParams {
  reverb: ReverbParams;
  delay: DelayParams;
  drive: DriveParams;
  compressor: CompressorParams;
}