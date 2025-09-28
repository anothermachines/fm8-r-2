import React from 'react';
import { GlobalFXParams } from '../types';
import Knob from './Knob';
import { TIME_DIVISIONS } from '../constants';

interface EffectsRackProps {
  fxParams: GlobalFXParams;
  onChange: (fx: 'reverb' | 'delay' | 'drive' | 'compressor', param: string, value: any) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode, gridCols?: number }> = ({ title, children, gridCols = 4 }) => (
    <div className="border-t border-[var(--accent-color)]/20 py-2">
        <h3 className="text-sm font-bold text-[var(--accent-color)]/80 uppercase tracking-widest mb-2 px-2">{title}</h3>
        <div className={`grid gap-x-1 gap-y-3 px-1`} style={{gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`}}>
            {children}
        </div>
    </div>
);

const Selector: React.FC<{ label: string; value: string; options: {value: string, label: string}[]; onChange: (value: string) => void; }> = ({ label, value, options, onChange }) => {
    const currentIndex = options.findIndex(o => o.value === value);
    const next = () => onChange(options[(currentIndex + 1) % options.length].value);
    const prev = () => onChange(options[(currentIndex - 1 + options.length) % options.length].value);

    return (
        <div className="flex flex-col items-center space-y-1.5 select-none">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-display h-4">{label}</span>
            <div className="flex items-center justify-center w-full">
                <button onClick={prev} className="px-1.5 py-2 text-gray-500 hover:text-white">{'<'}</button>
                <span className="flex-grow text-center text-sm font-bold text-[var(--text-screen)] bg-[#111] px-2 py-1 rounded-sm border border-black/50">
                    {options.find(o => o.value === value)?.label || '---'}
                </span>
                <button onClick={next} className="px-1.5 py-2 text-gray-500 hover:text-white">{'>'}</button>
            </div>
        </div>
    );
};

const EffectsRack: React.FC<EffectsRackProps> = ({ fxParams, onChange }) => {
  const { reverb, delay, drive, compressor } = fxParams;

  return (
    <div className="font-mono text-sm text-[var(--text-screen)] h-full overflow-y-auto no-scrollbar pt-2">
        <Section title="REVERB" gridCols={3}>
          <Knob label="DECAY" value={reverb.decay} min={0.01} max={1} step={0.01} onChange={v => onChange('reverb', 'decay', v)} />
          <div className="flex flex-col items-center">
             <div className="flex items-center justify-between w-full px-4 h-4 mb-1.5">
                 <span className="text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-wider">{reverb.preDelaySync ? 'DIV' : 'PRE-DLY'}</span>
                 <button onClick={() => onChange('reverb', 'preDelaySync', !reverb.preDelaySync)}
                    className={`px-1.5 text-[9px] font-bold rounded-sm transition-all border ${reverb.preDelaySync ? 'bg-[var(--accent-color)] text-black border-[var(--accent-color)]' : 'bg-gray-700/50 text-gray-300 border-black/50'}`}
                    style={{boxShadow: 'inset 0 1px 1px #0006'}}
                    >
                    SYNC
                 </button>
            </div>
            {reverb.preDelaySync ? (
                 <Selector label="" value={String(reverb.preDelayDivision)}
                    options={TIME_DIVISIONS.map(d => ({value: String(d.value), label: d.name}))}
                    onChange={v => onChange('reverb', 'preDelayDivision', Number(v))}
                 />
            ) : (
                <Knob label="" value={reverb.preDelay} min={0} max={0.5} step={0.001} onChange={v => onChange('reverb', 'preDelay', v)} unit="s" size={40} />
            )}
          </div>
          <Knob label="MIX" value={reverb.mix} min={0} max={1} step={0.01} onChange={v => onChange('reverb', 'mix', v)} />
        </Section>
        
        <Section title="DELAY" gridCols={3}>
          <div className="flex flex-col items-center">
             <div className="flex items-center justify-between w-full px-4 h-4 mb-1.5">
                 <span className="text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-wider">{delay.timeSync ? 'DIV' : 'TIME'}</span>
                 <button onClick={() => onChange('delay', 'timeSync', !delay.timeSync)}
                    className={`px-1.5 text-[9px] font-bold rounded-sm transition-all border ${delay.timeSync ? 'bg-[var(--accent-color)] text-black border-[var(--accent-color)]' : 'bg-gray-700/50 text-gray-300 border-black/50'}`}
                    style={{boxShadow: 'inset 0 1px 1px #0006'}}
                    >
                    SYNC
                 </button>
            </div>
            {delay.timeSync ? (
                <Selector label="" value={String(delay.timeDivision)}
                    options={TIME_DIVISIONS.map(d => ({value: String(d.value), label: d.name}))}
                    onChange={v => onChange('delay', 'timeDivision', Number(v))}
                />
            ) : (
                <Knob label="" value={delay.time} min={0.01} max={2} step={0.01} onChange={v => onChange('delay', 'time', v)} unit="s" size={40} />
            )}
          </div>
          <Knob label="FDBK" value={delay.feedback} min={0} max={0.95} step={0.01} onChange={v => onChange('delay', 'feedback', v)} />
          <Knob label="MIX" value={delay.mix} min={0} max={1} step={0.01} onChange={v => onChange('delay', 'mix', v)} />
        </Section>

        <Section title="DRIVE" gridCols={3}>
          <Knob label="AMT" value={drive.amount} min={0} max={100} step={1} onChange={v => onChange('drive', 'amount', v)} />
          <Knob label="TONE" value={drive.tone} min={350} max={10000} step={50} onChange={v => onChange('drive', 'tone', v)} unit="hz" />
          <Knob label="MIX" value={drive.mix} min={0} max={1} step={0.01} onChange={v => onChange('drive', 'mix', v)} />
        </Section>

        <Section title="COMPRESSOR" gridCols={3}>
            <Knob label="THRESH" value={compressor.threshold} min={-100} max={0} step={1} onChange={v => onChange('compressor', 'threshold', v)} unit="db" />
            <Knob label="RATIO" value={compressor.ratio} min={1} max={20} step={0.1} onChange={v => onChange('compressor', 'ratio', v)} unit=":1" />
            <Knob label="MAKEUP" value={compressor.makeup} min={0} max={24} step={0.1} onChange={v => onChange('compressor', 'makeup', v)} unit="db" />
            <Knob label="ATTACK" value={compressor.attack} min={0} max={1} step={0.001} onChange={v => onChange('compressor', 'attack', v)} unit="s" />
            <Knob label="RELEASE" value={compressor.release} min={0.01} max={1} step={0.001} onChange={v => onChange('compressor', 'release', v)} unit="s" />
            <Knob label="KNEE" value={compressor.knee} min={0} max={40} step={1} onChange={v => onChange('compressor', 'knee', v)} />
        </Section>
    </div>
  );
};

export default React.memo(EffectsRack);