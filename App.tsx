import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Track, StepState, PLocks, GlobalFXParams, LFOParams, AllInstrumentParams, TrackType } from './types';
import { INITIAL_TRACKS } from './constants';
import Sequencer from './components/Sequencer';
import InstrumentEditor from './components/InstrumentEditor';
import Knob from './components/Knob';
import EffectsRack from './components/EffectsRack';
import Mixer from './components/Mixer';
import { noteToFreq } from './utils';
import { audioBufferToWav } from './wavUtils';


const createRandomizedTrack = (track: Track): Track => {
    const melodicScale = ['C3', 'D#3', 'F3', 'G3', 'A#3', 'C4', 'D#4', 'F4', 'G4', 'A#4', 'C5'];
    
    // Polyrhythm: generate a new pattern length. Keep kick on 16 for stability.
    const newPatternLength = track.type === 'kick' ? 16 : 12 + Math.floor(Math.random() * 5); // 12-16 steps

    const newSteps: StepState[] = Array(16).fill(null).map(() => {
      const isActive = Math.random() > 0.65;
      const velocity = 0.6 + Math.random() * 0.4;
      let note: string | null = null;

      if (isActive && ['poly', 'bass', 'modal', 'rift', 'grain', 'scream'].includes(track.type)) {
        note = melodicScale[Math.floor(Math.random() * melodicScale.length)];
      }

      return {
        active: isActive,
        pLocks: null,
        note: note,
        velocity: velocity,
      };
    });

    // Special logic for kick to make it more useful
    if (track.type === 'kick') {
      for(let i = 0; i < 16; i++) {
        if (i % 4 === 0) { // Main beats
          newSteps[i] = { ...newSteps[i], active: true, velocity: 1.0 };
        } else if (Math.random() > 0.85) { // Ghost notes
          newSteps[i] = { ...newSteps[i], active: true, velocity: 0.3 + Math.random() * 0.3 };
        } else {
          newSteps[i].active = false;
        }
      }
    }

    return { ...track, steps: newSteps, patternLength: newPatternLength };
};


// --- Web Audio API Engine ---
class AudioEngine {
  private audioContext: AudioContext | OfflineAudioContext;
  private masterGain: GainNode;
  private masterCompressor: DynamicsCompressorNode;
  private makeupGain: GainNode;
  private preCompressorBus: GainNode;
  private noiseBuffer: AudioBuffer;

  // Global FX Nodes
  private reverb: ConvolverNode;
  private reverbPreDelay: DelayNode;
  private reverbWet: GainNode;
  private delay: DelayNode;
  private delayFeedback: GainNode;
  private delayWet: GainNode;
  private drive: WaveShaperNode;
  private driveTone: BiquadFilterNode;
  private driveWet: GainNode;


  constructor(context?: AudioContext | OfflineAudioContext) {
    this.audioContext = context || new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7; // Set a default comfortable level
    this.masterGain.connect(this.audioContext.destination);

    this.preCompressorBus = this.audioContext.createGain();
    this.masterCompressor = this.audioContext.createDynamicsCompressor();
    this.makeupGain = this.audioContext.createGain();
    
    this.preCompressorBus.connect(this.masterCompressor);
    this.masterCompressor.connect(this.makeupGain);
    this.makeupGain.connect(this.masterGain);
    
    this.reverbPreDelay = this.audioContext.createDelay(0.5);
    this.reverb = this.audioContext.createConvolver();
    this.reverbWet = this.audioContext.createGain();
    this.reverb.buffer = this.generateImpulseResponse(2, 2);
    this.reverbPreDelay.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.preCompressorBus);

    this.delay = this.audioContext.createDelay(2.0);
    this.delayFeedback = this.audioContext.createGain();
    this.delayWet = this.audioContext.createGain();
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.preCompressorBus);

    this.drive = this.audioContext.createWaveShaper();
    this.drive.oversample = '4x';
    this.driveTone = this.audioContext.createBiquadFilter();
    this.driveTone.type = 'lowpass';
    this.driveWet = this.audioContext.createGain();
    this.drive.connect(this.driveTone);
    this.driveTone.connect(this.driveWet);
    this.driveWet.connect(this.preCompressorBus);

    this.noiseBuffer = this.createNoiseBuffer();
  }

  public getContext() { return this.audioContext; }
  public resume() { if (this.audioContext.state === 'suspended') this.audioContext.resume(); }
  
  public setMasterVolume(volume: number) {
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  private applyEnvelope(param: AudioParam, time: number, attack: number, decay: number, sustain: number, peak: number) {
    const epsilon = 1e-6; 
    const attackEndTime = time + Math.max(0.001, attack);
    const sustainLevel = Math.max(epsilon, peak * sustain);

    param.setValueAtTime(epsilon, time);
    param.linearRampToValueAtTime(peak, attackEndTime);
    param.setTargetAtTime(sustainLevel, attackEndTime, decay / 4 + epsilon);
  }
  
  private applyEnvelopeWithRelease(param: AudioParam, time: number, attack: number, decay: number, sustain: number, release: number, peak: number) {
    const sustainLevel = peak * sustain;

    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(peak, time + attack);
    param.setTargetAtTime(sustainLevel, time + attack, decay / 4);

    param.setTargetAtTime(0, time + attack + decay, release / 4);
  }


  private createNoiseBuffer(): AudioBuffer {
    const bufferSize = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createTrackLimiter(): DynamicsCompressorNode {
    const limiter = this.audioContext.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1.0, 0);
    limiter.knee.setValueAtTime(0, 0);
    limiter.ratio.setValueAtTime(20.0, 0);
    limiter.attack.setValueAtTime(0.002, 0);
    limiter.release.setValueAtTime(0.1, 0);
    return limiter;
  }

  private generateImpulseResponse(duration: number, decay: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
  }
  
  private makeDistortionCurve(amount: number): Float32Array {
    const k = (typeof amount === 'number' ? amount : 50) * 1.5;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public updateReverb(params: GlobalFXParams['reverb'], bpm: number) {
    const { decay, mix, preDelay, preDelaySync, preDelayDivision } = params;
    this.reverb.buffer = this.generateImpulseResponse(Math.max(decay * 4, 0.01), decay * 2);
    this.reverbWet.gain.setValueAtTime(mix, this.audioContext.currentTime);
    const preDelayTime = preDelaySync ? (60 / bpm) * preDelayDivision : preDelay;
    this.reverbPreDelay.delayTime.setValueAtTime(preDelayTime, this.audioContext.currentTime);
  }

  public updateDelay(params: GlobalFXParams['delay'], bpm: number) {
    const { feedback, mix, timeSync, timeDivision } = params;
    const delayTime = timeSync ? (60 / bpm) * timeDivision : params.time;
    this.delay.delayTime.setValueAtTime(delayTime, this.audioContext.currentTime);
    this.delayFeedback.gain.setValueAtTime(feedback, this.audioContext.currentTime);
    this.delayWet.gain.setValueAtTime(mix, this.audioContext.currentTime);
  }

  public updateDrive(params: GlobalFXParams['drive']) {
    this.drive.curve = this.makeDistortionCurve(params.amount);
    this.driveTone.frequency.setValueAtTime(params.tone, this.audioContext.currentTime);
    this.driveWet.gain.setValueAtTime(params.mix, this.audioContext.currentTime);
  }

  public updateCompressor(params: GlobalFXParams['compressor']) {
    const now = this.audioContext.currentTime;
    this.masterCompressor.threshold.setValueAtTime(params.threshold, now);
    this.masterCompressor.ratio.setValueAtTime(params.ratio, now);
    this.masterCompressor.knee.setValueAtTime(params.knee, now);
    this.masterCompressor.attack.setValueAtTime(params.attack, now);
    this.masterCompressor.release.setValueAtTime(params.release, now);
    
    const makeupLinear = Math.pow(10, params.makeup / 20);
    this.makeupGain.gain.setValueAtTime(makeupLinear, now);
  }
  
  private connectToFX(sourceNode: AudioNode, fxSends: { reverb: number, delay: number, drive: number}) {
      if (fxSends.reverb > 0) { const g = this.audioContext.createGain(); g.gain.value = fxSends.reverb; sourceNode.connect(g); g.connect(this.reverbPreDelay); }
      if (fxSends.delay > 0) { const g = this.audioContext.createGain(); g.gain.value = fxSends.delay; sourceNode.connect(g); g.connect(this.delay); }
      if (fxSends.drive > 0) { const g = this.audioContext.createGain(); g.gain.value = fxSends.drive; sourceNode.connect(g); g.connect(this.drive); }
  }

  private applyLFO(lfoParams: LFOParams, time: number, targets: Record<string, AudioParam | undefined>) {
        if (!lfoParams || lfoParams.destination === 'none' || lfoParams.depth === 0) return;
        const targetParam = targets[lfoParams.destination];
        if (!targetParam) return;

        const lfo = this.audioContext.createOscillator();
        lfo.type = lfoParams.waveform;
        lfo.frequency.value = lfoParams.rate;

        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = lfoParams.depth;

        lfo.connect(lfoGain);
        lfoGain.connect(targetParam);
        
        lfo.start(time);
        return lfo;
  }

    private createKickVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
        if (track.type !== 'kick') return;
        const params = { ...track.params, ...(pLocks?.kickParams || {}) };
        const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
        const volume = pLocks?.volume ?? track.volume;
        const { tune, decay, punch, saturation, body, tone, transientAmount, pitchEnvAmount, pitchEnvDecay, filter, lfo1, lfo2, rumbleAmount, rumbleDecay, rumbleTone } = params;

        // --- Setup track output
        const trackOut = this.audioContext.createGain();
        trackOut.gain.value = volume * velocity;
        const limiter = this.createTrackLimiter();
        trackOut.connect(limiter);
        limiter.connect(this.preCompressorBus);
        this.connectToFX(limiter, fxSends);

        // --- Body Oscillator (Sine wave)
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteToFreq(noteString) * (tune / 50), time);

        // Pitch Envelope
        const pitchEnv = this.audioContext.createGain();
        pitchEnv.gain.setValueAtTime(pitchEnvAmount * 36, time); // Adjusted range
        pitchEnv.gain.exponentialRampToValueAtTime(0.0001, time + pitchEnvDecay);
        pitchEnv.connect(osc.detune);

        // Body Amp Envelope
        const amp = this.audioContext.createGain();
        const attackTime = Math.max(0.001, 0.02 - (punch / 100) * 0.019);
        this.applyEnvelope(amp.gain, time, attackTime, decay, 0, 1);
        osc.connect(amp);

        // --- Transient Generator (HP Filtered Noise)
        const transientSource = this.audioContext.createBufferSource();
        transientSource.buffer = this.noiseBuffer;
        const transientFilter = this.audioContext.createBiquadFilter();
        transientFilter.type = 'highpass';
        transientFilter.frequency.value = 4000;
        const transientAmp = this.audioContext.createGain();
        transientAmp.gain.value = (transientAmount / 100) * 0.8;
        this.applyEnvelope(transientAmp.gain, time, 0.001, 0.02, 0, 1);
        transientSource.connect(transientFilter);
        transientFilter.connect(transientAmp);

        // --- Saturation Path
        const preSaturatorMix = this.audioContext.createGain();
        amp.connect(preSaturatorMix);
        transientAmp.connect(preSaturatorMix);

        const saturatorDrive = this.audioContext.createGain();
        saturatorDrive.gain.value = 1.0 + (saturation / 100) * 4;
        preSaturatorMix.connect(saturatorDrive);

        const saturator = this.audioContext.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            let x = i * 2 / 255 - 1;
            curve[i] = Math.tanh(x);
        }
        saturator.curve = curve;
        saturator.oversample = '4x';
        saturatorDrive.connect(saturator);

        // --- Final Mixer (Clean Body vs Saturated Signal)
        const cleanGain = this.audioContext.createGain();
        cleanGain.gain.value = 1.0 - (body / 100);
        amp.connect(cleanGain);

        const saturatedGain = this.audioContext.createGain();
        saturatedGain.gain.value = body / 100;
        saturator.connect(saturatedGain);

        const finalMixer = this.audioContext.createGain();
        cleanGain.connect(finalMixer);
        saturatedGain.connect(finalMixer);

        const postMixGain = this.audioContext.createGain();
        postMixGain.gain.value = 0.9; // Headroom to prevent clipping
        finalMixer.connect(postMixGain);

        // --- Tone Control & Advanced Filter
        const toneFilter = this.audioContext.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = tone;
        toneFilter.Q.value = 0.71;
        postMixGain.connect(toneFilter);

        const mainFilter = this.audioContext.createBiquadFilter();
        mainFilter.type = filter.type;
        mainFilter.frequency.setValueAtTime(filter.cutoff, time);
        mainFilter.Q.setValueAtTime(filter.resonance, time);
        toneFilter.connect(mainFilter);

        // --- Mixer for Main sound and Rumble
        const mainAndRumbleMixer = this.audioContext.createGain();
        mainFilter.connect(mainAndRumbleMixer);
        mainAndRumbleMixer.connect(trackOut);

        // --- Rumble FX Chain
        let rumblePreGain: GainNode | undefined;
        let rumbleFilterNode: BiquadFilterNode | undefined;
        if (rumbleAmount > 0) {
            rumblePreGain = this.audioContext.createGain();
            rumblePreGain.gain.value = rumbleAmount / 100;
            postMixGain.connect(rumblePreGain); // Source is pre-tone/filter for a cleaner rumble

            const rumbleReverb = this.audioContext.createConvolver();
            rumbleReverb.buffer = this.generateImpulseResponse(Math.max(0.01, rumbleDecay * 2), rumbleDecay * 1.5);
            rumblePreGain.connect(rumbleReverb);

            rumbleFilterNode = this.audioContext.createBiquadFilter();
            rumbleFilterNode.type = 'lowpass';
            rumbleFilterNode.frequency.value = rumbleTone;
            rumbleFilterNode.Q.value = 1;
            rumbleReverb.connect(rumbleFilterNode);

            const ducker = this.audioContext.createGain();
            this.applyEnvelope(ducker.gain, time, 0.005, 0.1, 0, 1);
            amp.connect(ducker); // Main amp envelope triggers ducking

            const inverter = this.audioContext.createWaveShaper();
            inverter.curve = new Float32Array([-1, 1]);
            ducker.connect(inverter);

            const duckingAmount = this.audioContext.createGain();
            duckingAmount.gain.value = 1.0;
            inverter.connect(duckingAmount.gain);

            rumbleFilterNode.connect(duckingAmount);
            duckingAmount.connect(mainAndRumbleMixer);
        }

        // --- LFOs
        const lfos: OscillatorNode[] = [];
        const lfoTargets = {
            pitch: osc.detune,
            volume: trackOut.gain,
            filterCutoff: mainFilter.frequency,
            filterResonance: mainFilter.Q,
            kickSaturation: saturatorDrive.gain,
            kickTransient: transientAmp.gain,
            kickPitchEnv: pitchEnv.gain,
            kickBody: saturatedGain.gain,
            kickTone: toneFilter.frequency,
            kickRumbleAmt: rumblePreGain?.gain,
            kickRumbleTone: rumbleFilterNode?.frequency
        };
        const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
        if (lfo1Node) lfos.push(lfo1Node);
        const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
        if (lfo2Node) lfos.push(lfo2Node);

        // --- Start/Stop Scheduling
        const stopTime = time + decay + 2.0;
        osc.start(time);
        transientSource.start(time);
        osc.stop(stopTime);
        transientSource.stop(time + 0.1);
        lfos.forEach(lfo => lfo.stop(stopTime));
    }


  private createHatVoice(track: Track, pLocks: PLocks | null, time: number, velocity: number) {
    if (track.type !== 'hat') return;
    const params = { ...track.params, ...(pLocks?.hatParams || {}) };
    const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
    const volume = pLocks?.volume ?? track.volume;
    const { tone, decay, metal, filter, lfo1, lfo2 } = params;

    const trackOut = this.audioContext.createGain();
    trackOut.gain.value = volume * velocity;
    const limiter = this.createTrackLimiter();
    trackOut.connect(limiter);
    limiter.connect(this.preCompressorBus);
    this.connectToFX(limiter, fxSends);
    
    const amp = this.audioContext.createGain();
    this.applyEnvelope(amp.gain, time, 0.005, decay, 0, 1);
    
    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = tone;
    noiseSource.connect(noiseFilter);
    
    const metalMixer = this.audioContext.createGain();
    const stopTime = time + decay + 1.0;
    if (metal > 0) {
        const ratios = [1, 1.34, 1.68, 2.24, 2.78, 3.14];
        for (let i = 0; i < 6; i++) {
            const osc = this.audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.value = (100 + metal * 200) * ratios[i] + Math.random() * 20;
            osc.connect(metalMixer);
            osc.start(time);
            osc.stop(stopTime);
        }
    }
    const metalGain = this.audioContext.createGain();
    metalGain.gain.value = metal * 0.4;
    metalMixer.connect(metalGain);

    const sourceMixer = this.audioContext.createGain();
    noiseFilter.connect(sourceMixer);
    metalGain.connect(sourceMixer);

    const mainFilter = this.audioContext.createBiquadFilter();
    mainFilter.type = filter.type;
    mainFilter.frequency.setValueAtTime(filter.cutoff, time);
    mainFilter.Q.setValueAtTime(filter.resonance, time);

    sourceMixer.connect(amp);
    amp.connect(mainFilter);
    mainFilter.connect(trackOut);

    const lfos: OscillatorNode[] = [];
    const lfoTargets = { volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, hatTone: noiseFilter.frequency, hatMetal: metalGain.gain };
    const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
    if(lfo1Node) lfos.push(lfo1Node);
    const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
    if(lfo2Node) lfos.push(lfo2Node);

    noiseSource.start(time);
    noiseSource.stop(stopTime);
    lfos.forEach(lfo => lfo.stop(stopTime));
  }

  private createPolyVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
    if (track.type !== 'poly') return;
    const params = { ...track.params, ...(pLocks?.polyParams || {}) };
    const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
    const volume = pLocks?.volume ?? track.volume;
    const { osc1, osc2, oscMix, noiseLevel, filter, ampEnv, filterEnv, lfo1, lfo2 } = params;

    const trackOut = this.audioContext.createGain();
    trackOut.gain.value = volume * velocity;
    const limiter = this.createTrackLimiter();
    trackOut.connect(limiter);
    limiter.connect(this.preCompressorBus);
    this.connectToFX(limiter, fxSends);
    
    const baseFrequency = noteToFreq(noteString);

    const osc1Node = this.audioContext.createOscillator();
    osc1Node.type = osc1.waveform;
    osc1Node.frequency.setValueAtTime(baseFrequency * Math.pow(2, osc1.octave), time);
    osc1Node.detune.setValueAtTime(osc1.detune, time);
    
    const osc2Node = this.audioContext.createOscillator();
    osc2Node.type = osc2.waveform;
    osc2Node.frequency.setValueAtTime(baseFrequency * Math.pow(2, osc2.octave), time);
    osc2Node.detune.setValueAtTime(osc2.detune, time);

    const osc1Gain = this.audioContext.createGain();
    osc1Gain.gain.value = 1 - oscMix / 100;
    const osc2Gain = this.audioContext.createGain();
    osc2Gain.gain.value = oscMix / 100;
    
    osc1Node.connect(osc1Gain);
    osc2Node.connect(osc2Gain);

    const sourceMixer = this.audioContext.createGain();
    osc1Gain.connect(sourceMixer);
    osc2Gain.connect(sourceMixer);

    let noise: AudioBufferSourceNode | undefined;
    const noiseGain = this.audioContext.createGain();
    if (noiseLevel > 0) {
        noise = this.audioContext.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.loop = true;
        noiseGain.gain.value = noiseLevel;
        noise.connect(noiseGain);
        noiseGain.connect(sourceMixer);
        noise.start(time);
    }
    
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = filter.type;
    filterNode.Q.setValueAtTime(filter.resonance, time);
    filterNode.frequency.setValueAtTime(filter.cutoff, time);

    const amp = this.audioContext.createGain();
    sourceMixer.connect(filterNode);
    filterNode.connect(amp);
    amp.connect(trackOut);

    const totalDuration = ampEnv.attack + ampEnv.decay + ampEnv.release;
    this.applyEnvelopeWithRelease(amp.gain, time, ampEnv.attack, ampEnv.decay, ampEnv.sustain, ampEnv.release, 1.0);
    
    const filterEnvAmount = (pLocks?.polyParams?.filter as any)?.envAmount ?? params.filterEnv.attack > 0 ? 3000 : 0; // Legacy support
    if (filterEnvAmount !== 0) {
        const filterEnvMod = this.audioContext.createGain();
        this.applyEnvelopeWithRelease(filterEnvMod.gain, time, filterEnv.attack, filterEnv.decay, filterEnv.sustain, filterEnv.release, filterEnvAmount);
        filterEnvMod.connect(filterNode.frequency);
    }

    const lfos: OscillatorNode[] = [];
    const lfoTargets = { pitch: osc1Node.detune, volume: trackOut.gain, filterCutoff: filterNode.frequency, filterResonance: filterNode.Q, polyOscMix: osc2Gain.gain, polyNoise: noiseGain.gain };
    const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
    if(lfo1Node) lfos.push(lfo1Node);
    const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
    if(lfo2Node) lfos.push(lfo2Node);


    const stopTime = time + totalDuration + 2.0;
    osc1Node.start(time);
    osc2Node.start(time);
    osc1Node.stop(stopTime);
    osc2Node.stop(stopTime);
    if (noise) noise.stop(stopTime);
    lfos.forEach(lfo => lfo.stop(stopTime));
  }

  private createBassVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
    if (track.type !== 'bass') return;
    const params = { ...track.params, ...(pLocks?.bassParams || {}) };
    const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
    const volume = pLocks?.volume ?? track.volume;
    const { waveform, cutoff, resonance, decay, accent, filter, lfo1, lfo2 } = params;

    const trackOut = this.audioContext.createGain();
    trackOut.gain.value = volume * velocity;
    const limiter = this.createTrackLimiter();
    trackOut.connect(limiter);
    limiter.connect(this.preCompressorBus);
    this.connectToFX(limiter, fxSends);
    
    const baseFreq = noteToFreq(noteString);

    const osc = this.audioContext.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(baseFreq, time);

    const accentFilter = this.audioContext.createBiquadFilter();
    accentFilter.type = 'lowpass';
    accentFilter.Q.value = resonance;
    this.applyEnvelope(accentFilter.frequency, time, 0.001, accent / 100 * 0.5, 0, cutoff);
    
    const mainFilter = this.audioContext.createBiquadFilter();
    mainFilter.type = filter.type;
    mainFilter.frequency.setValueAtTime(filter.cutoff, time);
    mainFilter.Q.setValueAtTime(filter.resonance, time);

    const amp = this.audioContext.createGain();
    this.applyEnvelope(amp.gain, time, 0.001, decay, 0, 1);
    
    osc.connect(accentFilter);
    accentFilter.connect(mainFilter);
    mainFilter.connect(amp);
    amp.connect(trackOut);
    
    const lfos: OscillatorNode[] = [];
    const lfoTargets = { pitch: osc.detune, volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, bassCutoff: accentFilter.frequency };
    const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
    if(lfo1Node) lfos.push(lfo1Node);
    const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
    if(lfo2Node) lfos.push(lfo2Node);

    const stopTime = time + decay + 1.0;
    osc.start(time);
    osc.stop(stopTime);
    lfos.forEach(lfo => lfo.stop(stopTime));
  }

  private createModalVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
    if (track.type !== 'modal') return;
    const params = { ...track.params, ...(pLocks?.modalParams || {}) };
    const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
    const volume = pLocks?.volume ?? track.volume;
    const { structure, brightness, decay, damping, filter, lfo1, lfo2 } = params;

    const trackOut = this.audioContext.createGain();
    trackOut.gain.value = volume * velocity;
    const limiter = this.createTrackLimiter();
    trackOut.connect(limiter);
    limiter.connect(this.preCompressorBus);
    this.connectToFX(limiter, fxSends);
    
    const exciter = this.audioContext.createBufferSource();
    exciter.buffer = this.noiseBuffer;
    const exciterAmp = this.audioContext.createGain();
    exciter.connect(exciterAmp);
    this.applyEnvelope(exciterAmp.gain, time, 0.001, 0.05, 0, 1);

    const resonatorOut = this.audioContext.createGain();
    const NUM_MODES = 8;
    const HARMONIC_RATIOS = [1, 2, 3, 4, 5, 6, 7, 8];
    const METALLIC_RATIOS = [1, 2.76, 5.4, 8.9, 13.2, 18.3, 24.1, 30.8];
    const baseFreq = noteToFreq(noteString);

    const brightnessGain = this.audioContext.createGain();
    brightnessGain.gain.value = brightness / 100;

    for (let i = 0; i < NUM_MODES; i++) {
        const structRatio = structure / 100;
        const ratio = HARMONIC_RATIOS[i] * (1 - structRatio) + METALLIC_RATIOS[i] * structRatio;
        const freq = baseFreq * ratio;
        if (freq > this.audioContext.sampleRate / 2) continue;

        const gainVal = Math.pow(1 - (i / (NUM_MODES - 1)), (1 - brightness / 100) * 4);
        const baseQ = 50 + (decay * 200);
        const qVal = Math.min(200, baseQ * Math.max(0.1, (1 - (damping / 100) * (i / (NUM_MODES - 1))**2)));
        
        const modeFilter = this.audioContext.createBiquadFilter();
        modeFilter.type = 'bandpass';
        modeFilter.frequency.value = freq;
        modeFilter.Q.value = qVal;

        const modeGain = this.audioContext.createGain();
        modeGain.gain.value = gainVal / NUM_MODES;

        exciterAmp.connect(modeFilter);
        modeFilter.connect(modeGain);
        modeGain.connect(resonatorOut);
    }

    const mainFilter = this.audioContext.createBiquadFilter();
    mainFilter.type = filter.type;
    mainFilter.frequency.setValueAtTime(filter.cutoff, time);
    mainFilter.Q.setValueAtTime(filter.resonance, time);

    const amp = this.audioContext.createGain();
    this.applyEnvelope(amp.gain, time, 0.01, decay * 2, 0, 1);
    
    resonatorOut.connect(mainFilter);
    mainFilter.connect(amp);
    amp.connect(trackOut);

    const lfos: OscillatorNode[] = [];
    const lfoTargets = { volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, modalStructure: undefined, modalBrightness: brightnessGain.gain };
    const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
    if(lfo1Node) lfos.push(lfo1Node);
    const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
    if(lfo2Node) lfos.push(lfo2Node);

    const stopTime = time + decay + 1.0;
    exciter.start(time);
    exciter.stop(time + 0.1);
    lfos.forEach(lfo => lfo.stop(stopTime));
  }
  
  private createRiftVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
      if (track.type !== 'rift') return;
      const params = { ...track.params, ...(pLocks?.riftParams || {}) };
      const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
      const volume = pLocks?.volume ?? track.volume;
      const { pitch, fold, drive, feedback, decay, filter, lfo1, lfo2 } = params;

      const trackOut = this.audioContext.createGain();
      trackOut.gain.value = volume * velocity;
      const limiter = this.createTrackLimiter();
      trackOut.connect(limiter);
      limiter.connect(this.preCompressorBus);
      this.connectToFX(limiter, fxSends);

      const baseFreq = noteToFreq(noteString);

      const osc = this.audioContext.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.detune.setValueAtTime(pitch, time);

      const folder = this.audioContext.createWaveShaper();
      const n_samples = 256;
      const foldCurve = new Float32Array(n_samples);
      const foldAmount = 1.0 + fold / 100 * 8;
      for (let i = 0; i < n_samples; i++) {
          const x = i * 2 / (n_samples - 1) - 1;
          foldCurve[i] = Math.sin(x * Math.PI * foldAmount) * 0.5;
      }
      folder.curve = foldCurve;
      folder.oversample = '4x';

      const driveNode = this.audioContext.createWaveShaper();
      driveNode.curve = this.makeDistortionCurve(drive);
      driveNode.oversample = '4x';

      const feedbackPath = this.audioContext.createDelay(0.01);
      const feedbackGain = this.audioContext.createGain();
      feedbackGain.gain.value = feedback / 100 * 0.95; // feedback < 1 to prevent explosion

      const amp = this.audioContext.createGain();
      this.applyEnvelope(amp.gain, time, 0.005, decay, 0, 1.0);

      const mainFilter = this.audioContext.createBiquadFilter();
      mainFilter.type = filter.type;
      mainFilter.frequency.setValueAtTime(filter.cutoff, time);
      mainFilter.Q.setValueAtTime(filter.resonance, time);
      
      osc.connect(amp);
      amp.connect(folder);
      folder.connect(driveNode);
      driveNode.connect(feedbackPath);
      feedbackPath.connect(feedbackGain);
      feedbackGain.connect(folder); // Feedback loop
      driveNode.connect(mainFilter);
      mainFilter.connect(trackOut);

      const lfos: OscillatorNode[] = [];
      const lfoTargets = { pitch: osc.detune, volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, riftFold: undefined, riftDrive: undefined, riftFeedback: feedbackGain.gain };
      const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
      if(lfo1Node) lfos.push(lfo1Node);
      const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
      if(lfo2Node) lfos.push(lfo2Node);

      const stopTime = time + decay + 1.0;
      osc.start(time);
      osc.stop(stopTime);
      lfos.forEach(lfo => lfo.stop(stopTime));
  }
  
  private createGrainVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
      if (track.type !== 'grain') return;
      const params = { ...track.params, ...(pLocks?.grainParams || {}) };
      const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
      const volume = pLocks?.volume ?? track.volume;
      const { pitch, decay, density, spread, grainSize, filter, lfo1, lfo2 } = params;

      const trackOut = this.audioContext.createGain();
      trackOut.gain.value = volume * velocity;
      const limiter = this.createTrackLimiter();
      trackOut.connect(limiter);
      limiter.connect(this.preCompressorBus);
      this.connectToFX(limiter, fxSends);

      const baseFreq = noteToFreq(noteString);
      const grainCount = 2 + Math.floor(density / 100 * 20);
      const totalDuration = decay * 1.5;

      const grainPitch = this.audioContext.createGain();
      grainPitch.gain.setValueAtTime(pitch, time);

      const mainFilter = this.audioContext.createBiquadFilter();
      mainFilter.type = filter.type;
      mainFilter.frequency.setValueAtTime(filter.cutoff, time);
      mainFilter.Q.setValueAtTime(filter.resonance, time);
      mainFilter.connect(trackOut);

      for (let i = 0; i < grainCount; i++) {
          const startTime = time + (i / grainCount) * totalDuration * (1 - spread / 100);

          const grainOsc = this.audioContext.createOscillator();
          grainOsc.type = 'sine';
          grainOsc.frequency.setValueAtTime(baseFreq, startTime);
          grainPitch.connect(grainOsc.detune);

          const grainAmp = this.audioContext.createGain();
          const gSize = Math.max(0.01, grainSize / 100 * 0.2);
          this.applyEnvelope(grainAmp.gain, startTime, gSize * 0.5, gSize * 0.5, 0, 1);

          grainOsc.connect(grainAmp);
          grainAmp.connect(mainFilter);

          grainOsc.start(startTime);
          grainOsc.stop(startTime + gSize * 2);
      }
      
      const lfos: OscillatorNode[] = [];
      const lfoTargets = { pitch: undefined, volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, grainPitch: grainPitch.gain, grainDensity: undefined, grainSize: undefined };
      const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
      if(lfo1Node) lfos.push(lfo1Node);
      const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
      if(lfo2Node) lfos.push(lfo2Node);
      
      const stopTime = time + totalDuration + 1.0;
      lfos.forEach(lfo => lfo.stop(stopTime));
  }
  
  private createScreamVoice(track: Track, pLocks: PLocks | null, time: number, noteString: string, velocity: number) {
      if (track.type !== 'scream') return;
      const params = { ...track.params, ...(pLocks?.screamParams || {}) };
      const fxSends = { ...track.fxSends, ...(pLocks?.fxSends || {}) };
      const volume = pLocks?.volume ?? track.volume;
      const { pitch, decay, feedback, damping, filter, lfo1, lfo2 } = params;

      const trackOut = this.audioContext.createGain();
      trackOut.gain.value = volume * velocity * 0.8; // Tame it a bit
      const limiter = this.createTrackLimiter();
      trackOut.connect(limiter);
      limiter.connect(this.preCompressorBus);
      this.connectToFX(limiter, fxSends);

      const baseFreq = noteToFreq(noteString);

      const exciter = this.audioContext.createBufferSource();
      exciter.buffer = this.noiseBuffer;
      const exciterAmp = this.audioContext.createGain();
      exciter.connect(exciterAmp);
      this.applyEnvelope(exciterAmp.gain, time, 0.001, 0.02, 0, 1.0);

      const feedbackPath = this.audioContext.createDelay(1 / baseFreq);
      const feedbackGain = this.audioContext.createGain();
      feedbackGain.gain.value = Math.min(0.99, feedback / 100);

      const dampingFilter = this.audioContext.createBiquadFilter();
      dampingFilter.type = 'lowpass';
      dampingFilter.frequency.setValueAtTime(damping, time);
      dampingFilter.Q.value = 0.5;

      const mainFilter = this.audioContext.createBiquadFilter();
      mainFilter.type = filter.type;
      mainFilter.frequency.setValueAtTime(filter.cutoff, time);
      mainFilter.Q.setValueAtTime(filter.resonance, time);

      const amp = this.audioContext.createGain();
      this.applyEnvelope(amp.gain, time, 0.01, decay, 0, 1);

      exciterAmp.connect(feedbackPath);
      feedbackPath.connect(dampingFilter);
      dampingFilter.connect(feedbackGain);
      feedbackGain.connect(feedbackPath);

      feedbackGain.connect(mainFilter);
      mainFilter.connect(amp);
      amp.connect(trackOut);
      
      const lfos: OscillatorNode[] = [];
      const lfoTargets = { pitch: undefined, volume: trackOut.gain, filterCutoff: mainFilter.frequency, filterResonance: mainFilter.Q, screamFeedback: feedbackGain.gain, screamDamping: dampingFilter.frequency };
      const lfo1Node = this.applyLFO(lfo1, time, lfoTargets);
      if(lfo1Node) lfos.push(lfo1Node);
      const lfo2Node = this.applyLFO(lfo2, time, lfoTargets);
      if(lfo2Node) lfos.push(lfo2Node);
      
      const stopTime = time + decay + 1.0;
      exciter.start(time);
      exciter.stop(time + 0.05);
      lfos.forEach(lfo => lfo.stop(stopTime));
  }

  public trigger(track: Track, pLocks: PLocks | null, time: number, note: string, velocity: number) {
      switch (track.type) {
          case 'kick': return this.createKickVoice(track, pLocks, time, note, velocity);
          case 'hat': return this.createHatVoice(track, pLocks, time, velocity);
          case 'poly': return this.createPolyVoice(track, pLocks, time, note, velocity);
          case 'bass': return this.createBassVoice(track, pLocks, time, note, velocity);
          case 'modal': return this.createModalVoice(track, pLocks, time, note, velocity);
          case 'rift': return this.createRiftVoice(track, pLocks, time, note, velocity);
          case 'grain': return this.createGrainVoice(track, pLocks, time, note, velocity);
          case 'scream': return this.createScreamVoice(track, pLocks, time, note, velocity);
      }
  }
}


function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [currentStep, setCurrentStep] = useState(-1);
  const [selectedTrackId, setSelectedTrackId] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'synth' | 'fx' | 'mixer'>('synth');
  
  const [mutedTracks, setMutedTracks] = useState<Set<number>>(new Set());
  const [soloedTrackId, setSoloedTrackId] = useState<number | null>(null);
  
  const [pLockModeActive, setPLockModeActive] = useState(false);
  const [pLockEditStep, setPLockEditStep] = useState<{trackId: number, stepIndex: number} | null>(null);

  const [globalFxParams, setGlobalFxParams] = useState<GlobalFXParams>({
      reverb: { decay: 0.5, mix: 0.3, preDelay: 0.02, preDelaySync: false, preDelayDivision: 0.25 },
      delay: { time: 0.3, feedback: 0.4, mix: 0.3, timeSync: true, timeDivision: 0.75 },
      drive: { amount: 20, tone: 8000, mix: 0.1 },
      compressor: { threshold: -24, ratio: 4, knee: 10, attack: 0.003, release: 0.25, makeup: 3 },
  });

  const audioEngine = useRef<AudioEngine | null>(null);
  const schedulerTimer = useRef<number | null>(null);
  const nextNoteTime = useRef(0);
  const lookahead = 25.0; // ms
  const scheduleAheadTime = 0.1; // sec

  useEffect(() => {
      audioEngine.current = new AudioEngine();
      return () => {
          if (schedulerTimer.current) clearInterval(schedulerTimer.current);
          audioEngine.current?.getContext().close();
      };
  }, []);

  const scheduleNotes = useCallback(() => {
    if (!audioEngine.current) return;
    const context = audioEngine.current.getContext();
    const currentContextTime = context.currentTime;
    
    while (nextNoteTime.current < currentContextTime + scheduleAheadTime) {
        const stepTime = 60.0 / bpm / 4;
        const localCurrentStep = Math.floor(nextNoteTime.current / stepTime) % 16;
        
        tracks.forEach(track => {
            const isAudible = soloedTrackId === null ? !mutedTracks.has(track.id) : track.id === soloedTrackId;
            if (!isAudible) return;

            const localStepIndex = localCurrentStep % track.patternLength;
            const step = track.steps[localStepIndex];
            
            if (step && step.active) {
                const note = step.note || track.defaultNote;
                audioEngine.current?.trigger(track, step.pLocks, nextNoteTime.current, note, step.velocity);
            }
        });
        
        setCurrentStep(localCurrentStep);
        nextNoteTime.current += stepTime;
    }
  }, [tracks, bpm, mutedTracks, soloedTrackId]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
        setIsPlaying(false);
        setCurrentStep(-1);
        if (schedulerTimer.current) {
            clearInterval(schedulerTimer.current);
            schedulerTimer.current = null;
        }
    } else {
        if (!audioEngine.current) return;
        audioEngine.current.resume();
        nextNoteTime.current = audioEngine.current.getContext().currentTime;
        setIsPlaying(true);
        schedulerTimer.current = window.setInterval(scheduleNotes, lookahead);
    }
  }, [isPlaying, scheduleNotes]);

  useEffect(() => {
      if (audioEngine.current) {
          audioEngine.current.updateReverb(globalFxParams.reverb, bpm);
          audioEngine.current.updateDelay(globalFxParams.delay, bpm);
          audioEngine.current.updateDrive(globalFxParams.drive);
          audioEngine.current.updateCompressor(globalFxParams.compressor);
      }
  }, [globalFxParams, bpm]);

  const handleStepClick = useCallback((trackId: number, stepIndex: number) => {
    if (pLockModeActive) {
      if (pLockEditStep?.trackId === trackId && pLockEditStep?.stepIndex === stepIndex) {
         setPLockEditStep(null); // Deselect if clicking the same step
      } else {
         setPLockEditStep({ trackId, stepIndex });
      }
    } else {
        setTracks(currentTracks =>
            currentTracks.map(track => {
                if (track.id === trackId) {
                    const newSteps = [...track.steps];
                    const currentStep = newSteps[stepIndex];
                    newSteps[stepIndex] = { ...currentStep, active: !currentStep.active };
                    return { ...track, steps: newSteps };
                }
                return track;
            })
        );
    }
  }, [pLockModeActive, pLockEditStep]);
  
  const handlePatternLengthChange = useCallback((trackId: number, length: number) => {
    setTracks(currentTracks => currentTracks.map(track => track.id === trackId ? { ...track, patternLength: length } : track));
  }, []);
  
  const handleStepPropertyChange = useCallback((trackId: number, stepIndex: number, prop: keyof StepState, value: any) => {
    setTracks(currentTracks => currentTracks.map(track => {
      if (track.id === trackId) {
        const newSteps = [...track.steps];
        newSteps[stepIndex] = { ...newSteps[stepIndex], [prop]: value };
        return { ...track, steps: newSteps };
      }
      return track;
    }));
  }, []);

  const handleParamChange = useCallback((param: string, value: any) => {
    setTracks(currentTracks =>
        currentTracks.map(track => {
            if (track.id === selectedTrackId) {
                if (pLockModeActive && pLockEditStep) {
                    const { stepIndex } = pLockEditStep;
                    const newSteps = [...track.steps];
                    const currentStep = newSteps[stepIndex];
                    const pLocks = currentStep.pLocks || {};
                    const trackParamsKey = `${track.type}Params` as keyof PLocks;
                    
                    const newPLocks: PLocks = {
                      ...pLocks,
                      [trackParamsKey]: {
                        ...(pLocks[trackParamsKey] || {}),
                        [param]: value
                      }
                    };

                    newSteps[stepIndex] = { ...currentStep, pLocks: newPLocks };
                    return { ...track, steps: newSteps };
                } else {
                    return {
                        ...track,
                        params: { ...track.params, [param]: value } as AllInstrumentParams
                    };
                }
            }
            return track;
        })
    );
  }, [selectedTrackId, pLockModeActive, pLockEditStep]);
  
  const handleClearPLocksForTrack = (trackId: number) => {
    setTracks(currentTracks => currentTracks.map(track => {
        if (track.id === trackId) {
            const newSteps = track.steps.map(step => ({...step, pLocks: null, note: null, velocity: 1.0}));
            return {...track, steps: newSteps};
        }
        return track;
    }));
  };
  
  const handleGlobalFxChange = useCallback((fx: 'reverb' | 'delay' | 'drive' | 'compressor', param: string, value: any) => {
    setGlobalFxParams(currentParams => ({
      ...currentParams,
      [fx]: {
        ...currentParams[fx],
        [param]: value
      }
    }));
  }, []);

  const handleVolumeChange = useCallback((trackId: number, volume: number) => {
      setTracks(currentTracks => currentTracks.map(track => track.id === trackId ? { ...track, volume } : track));
  }, []);

  const handleMuteToggle = useCallback((trackId: number) => {
      setMutedTracks(currentMuted => {
          const newMuted = new Set(currentMuted);
          if (newMuted.has(trackId)) {
              newMuted.delete(trackId);
          } else {
              newMuted.add(trackId);
          }
          return newMuted;
      });
  }, []);

  const handleSoloToggle = useCallback((trackId: number) => {
      setSoloedTrackId(currentSoloed => currentSoloed === trackId ? null : trackId);
  }, []);
  
  const handleFxSendChange = useCallback((trackId: number, fx: 'reverb' | 'delay' | 'drive', value: number) => {
     setTracks(currentTracks => currentTracks.map(track => {
        if (track.id === trackId) {
            const newFxSends = { ...track.fxSends, [fx]: value };
            return { ...track, fxSends: newFxSends };
        }
        return track;
     }));
  }, []);

  const handleRandomPattern = useCallback((trackId: number) => {
    setTracks(currentTracks =>
      currentTracks.map(track => 
        track.id === trackId ? createRandomizedTrack(track) : track
      )
    );
  }, []);

  const handleRandomAll = useCallback(() => {
    setTracks(currentTracks => currentTracks.map(createRandomizedTrack));
  }, []);

  const selectedTrack = tracks.find(t => t.id === selectedTrackId) || null;
  const pLockStep = pLockModeActive && pLockEditStep ? tracks[pLockEditStep.trackId].steps[pLockEditStep.stepIndex] : null;
  
  const handleExportWav = async () => {
        const wasPlaying = isPlaying;
        if (wasPlaying) togglePlayback();

        const numSteps = 64; // Export 4 bars
        const stepTime = 60.0 / bpm / 4.0;
        const duration = numSteps * stepTime;
        
        const offlineContext = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
        const offlineEngine = new AudioEngine(offlineContext);

        // Update FX in offline engine
        offlineEngine.updateReverb(globalFxParams.reverb, bpm);
        offlineEngine.updateDelay(globalFxParams.delay, bpm);
        offlineEngine.updateDrive(globalFxParams.drive);
        offlineEngine.updateCompressor(globalFxParams.compressor);

        for (let i = 0; i < numSteps; i++) {
            const time = i * stepTime;
            tracks.forEach(track => {
                const isAudible = soloedTrackId === null ? !mutedTracks.has(track.id) : track.id === soloedTrackId;
                if (!isAudible) return;
                
                const stepIndex = i % track.patternLength;
                const step = track.steps[stepIndex];
                if (step && step.active) {
                    const note = step.note || track.defaultNote;
                    offlineEngine.trigger(track, step.pLocks, time, note, step.velocity);
                }
            });
        }
        
        const renderedBuffer = await offlineContext.startRendering();
        const wavData = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fm8r-export-${bpm}bpm.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

  return (
    <div className="bg-[var(--bg-chassis)] h-screen w-screen flex flex-col text-white select-none">
      
      {/* Header */}
      <header className="flex justify-between items-center p-2 border-b border-black/50 bg-gradient-to-b from-[#2a2a2e] to-[var(--bg-chassis)] flex-shrink-0">
        <div className="relative font-display group">
            <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-gray-400 to-gray-700 group-hover:from-gray-300 transition-colors">
                FM-8/R
            </h1>
            <h1 className="absolute top-0 left-0 text-2xl font-bold tracking-widest text-[var(--accent-color)] opacity-70 transition-opacity group-hover:opacity-100" style={{ filter: 'blur(6px)' }}>
                FM-8/R
            </h1>
        </div>

        <div className="flex items-center space-x-4">
          <Knob label="BPM" value={bpm} min={30} max={250} step={1} onChange={setBpm} size={40} />
          
          <button onClick={togglePlayback} className={`w-20 h-10 rounded-md font-bold text-sm uppercase tracking-wider transition-all border ${isPlaying ? 'bg-red-600 border-red-400 text-white' : 'bg-gray-700 border-gray-900 hover:bg-gray-600 text-gray-300'}`}>
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
          
          <button onClick={handleExportWav} title="Export 4 bars as WAV" className="h-10 px-3 rounded-md font-bold text-xs uppercase tracking-wider bg-gray-700 border-gray-900 hover:bg-gray-600 text-gray-300">
            EXPORT
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex p-2 space-x-2 overflow-hidden">
        
        {/* Left Panel: Synth/FX Editor */}
        <div className="w-1/2 lg:w-1/3 flex flex-col bg-[var(--bg-panel)] rounded-md border border-black/50 shadow-lg">
           <div className="flex-shrink-0 bg-black/30 p-1 flex space-x-1 border-b border-black">
              <button onClick={() => setSelectedTab('synth')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${selectedTab === 'synth' ? 'bg-[var(--accent-color)] text-black' : 'bg-gray-800/50 hover:bg-gray-700'}`}>Synth</button>
              <button onClick={() => setSelectedTab('fx')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${selectedTab === 'fx' ? 'bg-[var(--accent-color)] text-black' : 'bg-gray-800/50 hover:bg-gray-700'}`}>Master FX</button>
              <button onClick={() => setSelectedTab('mixer')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${selectedTab === 'mixer' ? 'bg-[var(--accent-color)] text-black' : 'bg-gray-800/50 hover:bg-gray-700'}`}>Mixer</button>
           </div>
           <div className="flex-grow overflow-hidden p-2">
                {selectedTab === 'synth' && <InstrumentEditor track={selectedTrack} pLocks={pLockStep?.pLocks ?? null} onParamChange={handleParamChange} isPLockMode={pLockModeActive}/>}
                {selectedTab === 'fx' && <EffectsRack fxParams={globalFxParams} onChange={handleGlobalFxChange} />}
                {selectedTab === 'mixer' && <Mixer tracks={tracks} mutedTracks={mutedTracks} soloedTrackId={soloedTrackId} onVolumeChange={handleVolumeChange} onMuteToggle={handleMuteToggle} onSoloToggle={handleSoloToggle} onFxSendChange={handleFxSendChange} />}
           </div>
        </div>

        {/* Right Panel: Sequencer */}
        <div className="w-1/2 lg:w-2/3">
          <Sequencer
            tracks={tracks}
            currentStep={currentStep}
            selectedTrackId={selectedTrackId}
            mutedTracks={mutedTracks}
            soloedTrackId={soloedTrackId}
            pLockModeActive={pLockModeActive}
            pLockEditStep={pLockEditStep}
            onStepClick={handleStepClick}
            onTrackSelect={setSelectedTrackId}
            onPatternLengthChange={handlePatternLengthChange}
            onStepPropertyChange={handleStepPropertyChange}
            onPLockToggle={() => { setPLockModeActive(v => !v); setPLockEditStep(null); }}
            onRandomPattern={handleRandomPattern}
            onRandomAll={handleRandomAll}
            onClearPLocks={handleClearPLocksForTrack}
          />
        </div>

      </main>
    </div>
  );
}

export default App;
