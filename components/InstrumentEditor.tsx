import React from 'react';
import { Track, PLocks, LFODestination, AllInstrumentParams, LFOParams, FilterParams } from '../types';
import Knob from './Knob';

const Section: React.FC<{ title: string; children: React.ReactNode, gridCols?: number }> = ({ title, children, gridCols = 4 }) => (
  <div className="border-t border-[var(--accent-color)]/20 py-2">
    <h3 className="text-sm font-bold text-[var(--accent-color)]/80 uppercase tracking-widest mb-2 px-2">{title}</h3>
    <div className={`grid gap-x-1 gap-y-3 px-1`} style={{gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`}}>
        {children}
    </div>
  </div>
);

const Selector: React.FC<{ label: string; value: string; options: {value: string, label: string}[]; onChange: (value: string) => void; isPLocked?: boolean }> = ({ label, value, options, onChange, isPLocked }) => {
    const currentIndex = options.findIndex(o => o.value === value);
    const next = () => onChange(options[(currentIndex + 1) % options.length].value);
    const prev = () => onChange(options[(currentIndex - 1 + options.length) % options.length].value);

    return (
        <div className="flex flex-col items-center space-y-1.5 select-none w-full">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-display h-4">{label}</span>
            <div className="flex items-center justify-center w-full">
                <button onClick={prev} className="px-1 text-gray-500 hover:text-white">{'<'}</button>
                <span className={`flex-grow text-center text-[11px] font-mono font-bold text-[var(--text-screen)] bg-[#111] px-2 py-1 rounded-sm border ${isPLocked ? 'border-[var(--plock-color)]' : 'border-black/50'}`}>
                    {options.find(o => o.value === value)?.label || '---'}
                </span>
                <button onClick={next} className="px-1 text-gray-500 hover:text-white">{'>'}</button>
            </div>
        </div>
    );
};

interface InstrumentEditorProps {
  track: Track | null;
  pLocks: PLocks | null;
  isPLockMode: boolean;
  onParamChange: (param: string, value: any) => void;
}

const LFO_WAVEFORM_OPTIONS = [{value: 'sine', label: 'SIN'}, {value: 'triangle', label: 'TRI'}, {value: 'sawtooth', label: 'SAW'}, {value: 'square', label: 'SQR'}];
const FILTER_TYPE_OPTIONS = [{value: 'lowpass', label: 'LP'}, {value: 'highpass', label: 'HP'}, {value: 'bandpass', label: 'BP'}];

const LFOSection: React.FC<{
    lfoNum: 1 | 2;
    params: AllInstrumentParams;
    pLocks: PLocks | null;
    trackType: Track['type'];
    onParamChange: (param: string, value: any) => void;
    destinationOptions: {value: string, label: string}[];
}> = ({ lfoNum, params, pLocks, trackType, onParamChange, destinationOptions }) => {
    
    const lfoKey = `lfo${lfoNum}` as 'lfo1' | 'lfo2';
    const trackParamsKey = `${trackType}Params` as keyof PLocks;

    const getVal = <K extends keyof LFOParams>(field: K): LFOParams[K] => {
        const pLockedLfo = pLocks?.[trackParamsKey]?.[lfoKey] as Partial<LFOParams> | undefined;
        const pLockedValue = pLockedLfo?.[field];
        if (pLockedValue !== undefined) {
            return pLockedValue as LFOParams[K];
        }
        if ('lfo1' in params && params.lfo1) {
             return params[lfoKey][field];
        }
        return '' as any; // Fallback for types without LFO
    };

    const isLocked = (field: keyof LFOParams) => {
        const pLockedLfo = pLocks?.[trackParamsKey]?.[lfoKey] as Partial<LFOParams> | undefined;
        return pLockedLfo?.[field] !== undefined;
    };
    
    const handleChange = (field: keyof LFOParams, value: any) => {
        if ('lfo1' in params && params.lfo1) {
            const currentLFO = params[lfoKey];
            onParamChange(lfoKey, { ...currentLFO, [field]: value });
        }
    }

    if (!('lfo1' in params)) return null;

    return (
        <Section title={`LFO ${lfoNum}`} gridCols={4}>
            <Selector label="WAVE" value={getVal('waveform')} options={LFO_WAVEFORM_OPTIONS} onChange={v => handleChange('waveform', v)} isPLocked={isLocked('waveform')} />
            <Knob label="RATE" value={getVal('rate')} min={0.01} max={50} step={0.01} onChange={v => handleChange('rate', v)} isPLocked={isLocked('rate')} unit="hz" />
            <Knob label="DEPTH" value={getVal('depth')} min={0} max={1000} step={1} onChange={v => handleChange('depth', v)} isPLocked={isLocked('depth')} />
            <Selector label="DEST" value={getVal('destination')} options={destinationOptions} onChange={v => handleChange('destination', v)} isPLocked={isLocked('destination')} />
        </Section>
    );
};

const FilterSection: React.FC<{
    params: AllInstrumentParams;
    pLocks: PLocks | null;
    trackType: Track['type'];
    onParamChange: (param: string, value: any) => void;
}> = ({ params, pLocks, trackType, onParamChange }) => {
    const getVal = (field: string) => pLocks?.[`${trackType}Params` as keyof PLocks]?.['filter' as keyof typeof pLocks[keyof PLocks]]?.[field] ?? (params as any).filter[field];
    const isLocked = (field: string) => pLocks?.[`${trackType}Params` as keyof PLocks]?.['filter'as keyof typeof pLocks[keyof PLocks]]?.[field] !== undefined;
    const handleChange = (field: keyof FilterParams, value: any) => {
        if ('filter' in params && typeof params.filter === 'object' && params.filter !== null) {
            // FIX: Use Object.assign instead of spread syntax to avoid TypeScript errors
            // when dealing with properties on union types.
            onParamChange('filter', Object.assign({}, params.filter, { [field]: value }));
        }
    }
    
    if (!('filter' in params)) return null;

    return (
         <Section title="FILTER" gridCols={3}>
            <Selector label="TYPE" value={getVal('type')} options={FILTER_TYPE_OPTIONS} onChange={v => handleChange('type', v)} isPLocked={isLocked('type')} />
            <Knob label="CUTOFF" value={getVal('cutoff')} min={20} max={20000} onChange={v => handleChange('cutoff', v)} isPLocked={isLocked('cutoff')} unit="hz" />
            <Knob label="RESO" value={getVal('resonance')} min={0.1} max={30} step={0.1} onChange={v => handleChange('resonance', v)} isPLocked={isLocked('resonance')} />
        </Section>
    );
};


const InstrumentEditor: React.FC<InstrumentEditorProps> = ({ track, pLocks, onParamChange }) => {
  if (!track) return null;

  const getVal = (paramName: string) => {
    return pLocks?.[`${track.type}Params` as keyof PLocks]?.[paramName as keyof typeof pLocks[keyof PLocks]]
        ?? (track.params as Record<string, any>)[paramName];
  }
  
  const isLocked = (paramName: string): boolean => {
    return pLocks?.[`${track.type}Params` as keyof PLocks]?.[paramName as keyof typeof pLocks[keyof PLocks]] !== undefined;
  };
  
  const handleNestedChange = (path: string, value: any) => {
      const [topLevel, nested] = path.split('.');
      const currentTopLevelVal = getVal(topLevel);
      if (typeof currentTopLevelVal === 'object' && currentTopLevelVal !== null) {
        onParamChange(topLevel, { ...currentTopLevelVal, [nested]: value });
      }
  };
  
  const getNestedVal = (path: string) => {
      const [topLevel, nested] = path.split('.');
      const val = getVal(topLevel);
      return val ? val[nested] : undefined;
  };

  const isNestedLocked = (path: string): boolean => {
      const [topLevel, nested] = path.split('.');
      const pLockedTopLevel = pLocks?.[`${track.type}Params` as keyof PLocks]?.[topLevel as keyof typeof pLocks[keyof PLocks]];
      return pLockedTopLevel ? pLockedTopLevel[nested] !== undefined : false;
  };

  const renderKickEditor = () => {
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'kickSaturation', label: 'SAT'}, {value: 'kickTransient', label: 'TRANS'}, {value: 'kickPitchEnv', label: 'P.ENV'},
        {value: 'kickBody', label: 'BODY'}, {value: 'kickTone', label: 'TONE'},
        {value: 'kickRumbleAmt', label: 'R.AMT'}, {value: 'kickRumbleDecay', label: 'R.DEC'}, {value: 'kickRumbleTone', label: 'R.TONE'}
    ];
    return <>
      <Section title="KICK SYNTHESIS" gridCols={3}>
        <Knob label="TUNE" value={getVal('tune')} min={20} max={80} step={0.1} onChange={v => onParamChange('tune', v)} isPLocked={isLocked('tune')} />
        <Knob label="DECAY" value={getVal('decay')} min={0.1} max={2.0} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
        <Knob label="PUNCH" value={getVal('punch')} min={0} max={100} onChange={v => onParamChange('punch', v)} isPLocked={isLocked('punch')} />
        <Knob label="SATURATE" value={getVal('saturation')} min={0} max={100} onChange={v => onParamChange('saturation', v)} isPLocked={isLocked('saturation')} />
        <Knob label="BODY" value={getVal('body')} min={0} max={100} onChange={v => onParamChange('body', v)} isPLocked={isLocked('body')} />
        <Knob label="TONE" value={getVal('tone')} min={200} max={18000} onChange={v => onParamChange('tone', v)} isPLocked={isLocked('tone')} unit="hz"/>
        <Knob label="TRANSIENT" value={getVal('transientAmount')} min={0} max={100} onChange={v => onParamChange('transientAmount', v)} isPLocked={isLocked('transientAmount')} />
        <Knob label="P.ENV AMT" value={getVal('pitchEnvAmount')} min={0} max={100} onChange={v => onParamChange('pitchEnvAmount', v)} isPLocked={isLocked('pitchEnvAmount')} />
        <Knob label="P.ENV DEC" value={getVal('pitchEnvDecay')} min={0.01} max={0.5} step={0.001} onChange={v => onParamChange('pitchEnvDecay', v)} isPLocked={isLocked('pitchEnvDecay')} />
      </Section>
      <Section title="RUMBLE FX" gridCols={3}>
        <Knob label="RUMBLE AMT" value={getVal('rumbleAmount')} min={0} max={100} onChange={v => onParamChange('rumbleAmount', v)} isPLocked={isLocked('rumbleAmount')} />
        <Knob label="RUMBLE DEC" value={getVal('rumbleDecay')} min={0.1} max={2.0} step={0.01} onChange={v => onParamChange('rumbleDecay', v)} isPLocked={isLocked('rumbleDecay')} />
        <Knob label="RUMBLE TONE" value={getVal('rumbleTone')} min={100} max={2000} onChange={v => onParamChange('rumbleTone', v)} isPLocked={isLocked('rumbleTone')} unit="hz" />
      </Section>
      <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
      <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
  };

  const renderHatEditor = () => {
      const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'hatTone', label: 'TONE'}, {value: 'hatMetal', label: 'METAL'}
    ];
      return <>
        <Section title="HAT">
            <Knob label="TONE" value={getVal('tone')} min={2000} max={18000} onChange={v => onParamChange('tone', v)} isPLocked={isLocked('tone')} />
            <Knob label="DECAY" value={getVal('decay')} min={0.01} max={0.5} step={0.001} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
            <Knob label="METAL" value={getVal('metal')} min={0} max={1} step={0.01} onChange={v => onParamChange('metal', v)} isPLocked={isLocked('metal')} />
        </Section>
        <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
        <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
        <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
  };

  const renderPolyEditor = () => {
    const waveformOptions = [{value: 'sine', label: 'SIN'}, {value: 'triangle', label: 'TRI'}, {value: 'sawtooth', label: 'SAW'}, {value: 'square', label: 'SQR'}];
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'polyOscMix', label: 'MIX'}, {value: 'polyNoise', label: 'NOISE'}
    ];
    return (
    <>
      <Section title="OSCILLATORS" gridCols={2}>
        <div className="border border-white/10 rounded p-2 space-y-2">
            <h4 className="text-xs text-center text-gray-400">OSC 1</h4>
            <Selector label="WAVE" value={getNestedVal('osc1.waveform')} options={waveformOptions} onChange={v => handleNestedChange('osc1.waveform', v)} isPLocked={isNestedLocked('osc1.waveform')} />
            <div className="flex justify-around">
                <Knob label="OCT" value={getNestedVal('osc1.octave')} min={-2} max={2} step={1} onChange={v => handleNestedChange('osc1.octave', v)} isPLocked={isNestedLocked('osc1.octave')} />
                <Knob label="DETUNE" value={getNestedVal('osc1.detune')} min={-50} max={50} step={0.1} onChange={v => handleNestedChange('osc1.detune', v)} isPLocked={isNestedLocked('osc1.detune')} unit="c"/>
            </div>
        </div>
         <div className="border border-white/10 rounded p-2 space-y-2">
            <h4 className="text-xs text-center text-gray-400">OSC 2</h4>
            <Selector label="WAVE" value={getNestedVal('osc2.waveform')} options={waveformOptions} onChange={v => handleNestedChange('osc2.waveform', v)} isPLocked={isNestedLocked('osc2.waveform')} />
            <div className="flex justify-around">
                <Knob label="OCT" value={getNestedVal('osc2.octave')} min={-2} max={2} step={1} onChange={v => handleNestedChange('osc2.octave', v)} isPLocked={isNestedLocked('osc2.octave')} />
                <Knob label="DETUNE" value={getNestedVal('osc2.detune')} min={-50} max={50} step={0.1} onChange={v => handleNestedChange('osc2.detune', v)} isPLocked={isNestedLocked('osc2.detune')} unit="c"/>
            </div>
        </div>
      </Section>
      <Section title="MIX & FILTER" gridCols={4}>
          <Knob label="MIX" value={getVal('oscMix')} min={0} max={100} onChange={v => onParamChange('oscMix', v)} isPLocked={isLocked('oscMix')} />
          <Knob label="NOISE" value={getVal('noiseLevel')} min={0} max={1} step={0.01} onChange={v => onParamChange('noiseLevel', v)} isPLocked={isLocked('noiseLevel')} />
          <div /><div />
          <Selector label="TYPE" value={getNestedVal('filter.type')} options={FILTER_TYPE_OPTIONS} onChange={v => handleNestedChange('filter.type', v)} isPLocked={isNestedLocked('filter.type')} />
          <Knob label="CUTOFF" value={getNestedVal('filter.cutoff')} min={20} max={20000} onChange={v => handleNestedChange('filter.cutoff', v)} isPLocked={isNestedLocked('filter.cutoff')} />
          <Knob label="RESO" value={getNestedVal('filter.resonance')} min={0.1} max={30} step={0.1} onChange={v => handleNestedChange('filter.resonance', v)} isPLocked={isNestedLocked('filter.resonance')} />
      </Section>
      <Section title="AMP ENV">
          <Knob label="ATK" value={getNestedVal('ampEnv.attack')} min={0.01} max={4} step={0.01} onChange={v => handleNestedChange('ampEnv.attack', v)} isPLocked={isNestedLocked('ampEnv.attack')} />
          <Knob label="DEC" value={getNestedVal('ampEnv.decay')} min={0.01} max={4} step={0.01} onChange={v => handleNestedChange('ampEnv.decay', v)} isPLocked={isNestedLocked('ampEnv.decay')} />
          <Knob label="SUS" value={getNestedVal('ampEnv.sustain')} min={0} max={1} step={0.01} onChange={v => handleNestedChange('ampEnv.sustain', v)} isPLocked={isNestedLocked('ampEnv.sustain')} />
          <Knob label="REL" value={getNestedVal('ampEnv.release')} min={0.01} max={4} step={0.01} onChange={v => handleNestedChange('ampEnv.release', v)} isPLocked={isNestedLocked('ampEnv.release')} />
      </Section>
      <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
    );
  };
  
  const renderBassEditor = () => {
    const waveformOptions = [{value: 'sine', label: 'SIN'}, {value: 'triangle', label: 'TRI'}, {value: 'sawtooth', label: 'SAW'}, {value: 'square', label: 'SQR'}];
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'bassCutoff', label: 'ACCENT'}
    ];
    return (
        <>
            <Section title="BASSLINE">
                <Selector label="WAVE" value={getVal('waveform')} options={waveformOptions} onChange={v => onParamChange('waveform', v)} isPLocked={isLocked('waveform')} />
                <Knob label="CUTOFF" value={getVal('cutoff')} min={20} max={20000} onChange={v => onParamChange('cutoff', v)} isPLocked={isLocked('cutoff')} />
                <Knob label="RESO" value={getVal('resonance')} min={0} max={30} step={0.1} onChange={v => onParamChange('resonance', v)} isPLocked={isLocked('resonance')} />
                <Knob label="DECAY" value={getVal('decay')} min={0.01} max={1.0} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
                <Knob label="ACCENT" value={getVal('accent')} min={0} max={100} onChange={v => onParamChange('accent', v)} isPLocked={isLocked('accent')} />
            </Section>
            <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
            <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
            <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
        </>
    )
  };

  const renderModalEditor = () => {
      const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'modalStructure', label: 'STRUCT'}, {value: 'modalBrightness', label: 'BRIGHT'}
    ];
      return <>
        <Section title="MODAL">
            <Knob label="STRUCT" value={getVal('structure')} min={0} max={100} onChange={v => onParamChange('structure', v)} isPLocked={isLocked('structure')} />
            <Knob label="BRIGHT" value={getVal('brightness')} min={0} max={100} onChange={v => onParamChange('brightness', v)} isPLocked={isLocked('brightness')} />
            <Knob label="DECAY" value={getVal('decay')} min={0.01} max={1} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
            <Knob label="DAMPING" value={getVal('damping')} min={0} max={100} onChange={v => onParamChange('damping', v)} isPLocked={isLocked('damping')} />
        </Section>
        <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
        <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
        <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      </>
  };
  
   const renderRiftEditor = () => {
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'riftFold', label: 'FOLD'}, {value: 'riftDrive', label: 'DRIVE'}, {value: 'riftFeedback', label: 'FDBK'}
    ];
    return <>
      <Section title="RIFT SYNTH">
        <Knob label="PITCH" value={getVal('pitch')} min={-1200} max={1200} onChange={v => onParamChange('pitch', v)} isPLocked={isLocked('pitch')} unit="c"/>
        <Knob label="FOLD" value={getVal('fold')} min={0} max={100} onChange={v => onParamChange('fold', v)} isPLocked={isLocked('fold')} />
        <Knob label="DRIVE" value={getVal('drive')} min={0} max={100} onChange={v => onParamChange('drive', v)} isPLocked={isLocked('drive')} />
        <Knob label="FDBK" value={getVal('feedback')} min={0} max={95} onChange={v => onParamChange('feedback', v)} isPLocked={isLocked('feedback')} unit="%"/>
        <Knob label="DECAY" value={getVal('decay')} min={0.01} max={2} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
      </Section>
      <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
      <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
  };

  const renderGrainEditor = () => {
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'grainPitch', label: 'PITCH'}, {value: 'grainDensity', label: 'DENSE'}, {value: 'grainSize', label: 'SIZE'}
    ];
    return <>
      <Section title="GRAIN">
        <Knob label="PITCH" value={getVal('pitch')} min={-1200} max={1200} onChange={v => onParamChange('pitch', v)} isPLocked={isLocked('pitch')} unit="c"/>
        <Knob label="DECAY" value={getVal('decay')} min={0.1} max={2} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
        <Knob label="DENSITY" value={getVal('density')} min={0} max={100} onChange={v => onParamChange('density', v)} isPLocked={isLocked('density')} />
        <Knob label="SPREAD" value={getVal('spread')} min={0} max={100} onChange={v => onParamChange('spread', v)} isPLocked={isLocked('spread')} />
        <Knob label="SIZE" value={getVal('grainSize')} min={0} max={100} onChange={v => onParamChange('grainSize', v)} isPLocked={isLocked('grainSize')} />
      </Section>
      <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
      <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
  };
  
  const renderScreamEditor = () => {
    const destOptions: {value: LFODestination, label: string}[] = [
        {value: 'none', label: 'NONE'}, {value: 'pitch', label: 'PITCH'}, {value: 'volume', label: 'VOL'},
        {value: 'filterCutoff', label: 'CUT'}, {value: 'filterResonance', label: 'RES'},
        {value: 'screamFeedback', label: 'FDBK'}, {value: 'screamDamping', label: 'DAMP'}
    ];
    return <>
      <Section title="SCREAM">
        <Knob label="PITCH" value={getVal('pitch')} min={-1200} max={1200} onChange={v => onParamChange('pitch', v)} isPLocked={isLocked('pitch')} unit="c"/>
        <Knob label="DECAY" value={getVal('decay')} min={0.1} max={2} step={0.01} onChange={v => onParamChange('decay', v)} isPLocked={isLocked('decay')} />
        <Knob label="FDBK" value={getVal('feedback')} min={0} max={100} onChange={v => onParamChange('feedback', v)} isPLocked={isLocked('feedback')} />
        <Knob label="DAMPING" value={getVal('damping')} min={100} max={10000} onChange={v => onParamChange('damping', v)} isPLocked={isLocked('damping')} unit="hz" />
      </Section>
      <FilterSection params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} />
      <LFOSection lfoNum={1} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
      <LFOSection lfoNum={2} params={track.params} pLocks={pLocks} trackType={track.type} onParamChange={onParamChange} destinationOptions={destOptions} />
    </>
  };

  const renderContent = () => {
    switch (track.type) {
      case 'kick': return renderKickEditor();
      case 'hat': return renderHatEditor();
      case 'poly': return renderPolyEditor();
      case 'bass': return renderBassEditor();
      case 'modal': return renderModalEditor();
      case 'rift': return renderRiftEditor();
      case 'grain': return renderGrainEditor();
      case 'scream': return renderScreamEditor();
      default: return null;
    }
  };

  return (
    <div className="font-mono text-sm text-[var(--text-screen)] h-full overflow-y-auto no-scrollbar pt-2">
        {renderContent()}
    </div>
  );
};

export default React.memo(InstrumentEditor);