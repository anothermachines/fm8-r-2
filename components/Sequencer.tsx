import React, { useState, useEffect, useRef } from 'react';
import { Track, StepState } from '../types';
import Knob from './Knob';
import { noteNameToMidi, midiToNoteName } from '../utils';

interface StepButtonProps {
    step: StepState;
    stepIndex: number;
    isCurrent: boolean;
    isSelectedTrack: boolean;
    patternLength: number;
    onClick: () => void;
}

const StepButton: React.FC<StepButtonProps> = React.memo(({ step, stepIndex, isCurrent, isSelectedTrack, patternLength, onClick }) => {
    const isActive = step?.active ?? false;
    const hasLocks = (!!step?.pLocks && Object.keys(step.pLocks).length > 0) || step?.note !== null || step?.velocity < 1;
    const isOutOfBounds = stepIndex >= patternLength;

    const quarter = Math.floor(stepIndex % 16 / 4);
    let bgClass = 'bg-[#222]';
    if (quarter % 2 === 0) {
        bgClass = 'bg-[#2a2a2e]';
    }
    
    if (isOutOfBounds) {
        bgClass = 'bg-[#111]';
    } else if (isActive) {
        bgClass = 'bg-[var(--accent-color)]';
    }
    
    return (
        <button
            onClick={onClick}
            className={`relative w-full aspect-square rounded transition-all duration-50 border border-black/50 ${isOutOfBounds ? 'opacity-30' : ''}`}
            aria-label={`Step ${stepIndex + 1}`}
            disabled={isOutOfBounds}
        >
            <div className={`absolute inset-0.5 rounded-sm ${bgClass}`} style={{ boxShadow: isActive ? `0 0 8px #e74c3c66` : 'inset 0 1px 2px rgba(0,0,0,0.5)' }}></div>
             {hasLocks && !isOutOfBounds && (
                <div className="absolute w-1 h-1 rounded-full bg-white/70" style={{ top: '3px', right: '3px' }} title="Parameter locked" />
            )}
             {isCurrent && isActive && (
                <div className="absolute inset-0.5 rounded-sm bg-white animate-pulse" style={{ animationDuration: '200ms' }}></div>
            )}
        </button>
    );
});

interface SequencerProps {
    tracks: Track[];
    currentStep: number;
    selectedTrackId: number;
    mutedTracks: Set<number>;
    soloedTrackId: number | null;
    pLockModeActive: boolean;
    pLockEditStep: { trackId: number; stepIndex: number; } | null;
    onStepClick: (trackId: number, stepIndex: number) => void;
    onTrackSelect: (trackId: number) => void;
    onPatternLengthChange: (trackId: number, length: number) => void;
    onStepPropertyChange: (trackId: number, stepIndex: number, prop: keyof StepState, value: any) => void;
    onPLockToggle: () => void;
    onRandomPattern: (trackId: number) => void;
    onRandomAll: () => void;
    onClearPLocks: (trackId: number) => void;
}

const Sequencer: React.FC<SequencerProps> = React.memo(({ 
    tracks, currentStep, selectedTrackId, mutedTracks, soloedTrackId, pLockModeActive, pLockEditStep,
    onStepClick, onTrackSelect, onPatternLengthChange,
    onStepPropertyChange, onPLockToggle, onRandomPattern, onRandomAll, onClearPLocks
}) => {
  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const pLockStepState = pLockEditStep ? tracks[pLockEditStep.trackId].steps[pLockEditStep.stepIndex] : null;
  const gridRef = useRef<HTMLDivElement>(null);

  if (!selectedTrack) return null;

  const handleClearNoteLock = () => {
      if (pLockEditStep) {
          onStepPropertyChange(pLockEditStep.trackId, pLockEditStep.stepIndex, 'note', null);
      }
  };

  const playheadStep = currentStep;
  
  return (
    <div className="bg-black/20 p-3 rounded-md border border-black flex flex-col h-full space-y-2">
        {/* Toolbar */}
        <div className="flex justify-between items-center bg-black/30 p-2 rounded border border-black flex-shrink-0">
            <div className='flex items-center space-x-2'>
                <button onClick={() => onRandomPattern(selectedTrackId)} className="px-2 py-1 text-xs font-bold rounded-sm bg-gray-700 hover:bg-gray-600 border border-black/50">RANDOM</button>
                <button onClick={onRandomAll} className="px-2 py-1 text-xs font-bold rounded-sm bg-gray-700 hover:bg-gray-600 border border-black/50">RANDOM ALL</button>
            </div>
        </div>
        
        {/* Main Grid Area */}
        <div className="flex-grow flex space-x-2">
            {/* Track Info/Selectors */}
            <div className="flex flex-col space-y-1 w-24">
                {tracks.map(track => {
                    const isSelected = track.id === selectedTrackId;
                    const isMuted = mutedTracks.has(track.id);
                    const isSoloed = soloedTrackId === track.id;
                    const isAudible = soloedTrackId === null ? !isMuted : isSoloed;
                    return (
                        <button key={track.id} onClick={() => onTrackSelect(track.id)}
                            className="h-full w-full flex items-center justify-center rounded text-[11px] font-bold uppercase tracking-wider transition-all duration-150 border"
                            style={{
                                background: isSelected ? 'var(--accent-color)' : '#333',
                                color: 'var(--text-light)',
                                borderColor: isSelected ? 'var(--accent-glow)' : '#222',
                                opacity: isAudible ? 1 : 0.4,
                            }}>
                            {track.name}
                        </button>
                    );
                })}
            </div>

            {/* Step Grid */}
            <div className="relative flex-grow" ref={gridRef}>
                 {currentStep !== -1 && (
                     <div className="absolute top-0 bottom-0 bg-white/10 rounded pointer-events-none"
                         style={{
                             width: `calc(100% / 16)`,
                             left: `${playheadStep * 100 / 16}%`,
                             transition: 'left 50ms linear',
                         }}
                     />
                 )}
                <div className="grid grid-cols-16 grid-rows-8 gap-1 h-full">
                    {tracks.map(track => (
                        <React.Fragment key={track.id}>
                            {Array.from({ length: 16 }).map((_, i) => {
                                const stepIndex = i;
                                const step = track.steps[stepIndex];
                                return (
                                    <StepButton
                                        key={`${track.id}-${stepIndex}`}
                                        step={step}
                                        stepIndex={stepIndex}
                                        isCurrent={currentStep === stepIndex}
                                        isSelectedTrack={track.id === selectedTrackId}
                                        patternLength={track.patternLength}
                                        onClick={() => onStepClick(track.id, stepIndex)}
                                    />
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>

        {/* P-Lock Bar */}
        <div className="flex justify-between items-stretch bg-black/30 p-2 rounded border border-black flex-shrink-0 space-x-2 h-24">
            <div className="flex items-center space-x-2 flex-grow">
                 <Knob 
                    label="LENGTH" value={selectedTrack?.patternLength || 16} min={1} max={16} step={1}
                    onChange={(v) => onPatternLengthChange(selectedTrackId, v)} size={40} className="w-20"
                 />
                 <button onClick={() => onClearPLocks(selectedTrackId)} className="self-end mb-1 h-10 px-2 text-[10px] font-bold rounded-sm bg-gray-700 hover:bg-gray-600 border border-black/50">CLEAR P-LOCKS</button>

                 {pLockEditStep && pLockStepState && selectedTrack ? (
                    <>
                        <div className="relative w-20">
                            <Knob 
                                label="PITCH"
                                value={noteNameToMidi(pLockStepState.note ?? selectedTrack.defaultNote ?? 'C3')}
                                min={0} max={127} step={1}
                                onChange={(v) => onStepPropertyChange(pLockEditStep.trackId, pLockEditStep.stepIndex, 'note', midiToNoteName(v))}
                                size={40}
                                displayTransform={(v) => midiToNoteName(v)}
                                isPLocked={pLockStepState.note !== null}
                            />
                            {pLockStepState.note !== null && (
                                <button onClick={handleClearNoteLock} className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-[10px] font-bold border border-red-300 flex items-center justify-center shadow-lg hover:bg-red-500" title="Clear Note Lock">
                                    &times;
                                </button>
                            )}
                        </div>
                        <Knob 
                            label="VEL"
                            value={pLockStepState.velocity * 100}
                            min={0} max={100} step={1}
                            onChange={(v) => onStepPropertyChange(pLockEditStep.trackId, pLockEditStep.stepIndex, 'velocity', v / 100)}
                            size={40} unit="%" className="w-16"
                            isPLocked={pLockStepState.velocity < 1}
                        />
                    </>
                 ) : <div className="flex-grow text-center text-xs text-gray-500 font-mono self-center">SELECT A STEP IN P-LOCK MODE TO EDIT NOTE/VEL</div>}
            </div>
            
            <button onClick={onPLockToggle} className={`px-4 py-2 my-1 rounded-md font-bold text-sm uppercase tracking-wider transition-all border w-32 ${pLockModeActive ? 'bg-red-600 border-red-400 text-white' : 'bg-gray-700 border-gray-900 hover:bg-gray-600 text-gray-300'}`} style={{ boxShadow: pLockModeActive ? '0 0 10px var(--plock-color), inset 0 0 5px #f66a' : 'inset 0 1px 2px rgba(0,0,0,0.6)'}}>
                P-LOCK <span className={`ml-2 inline-block w-2 h-2 rounded-full ${pLockModeActive ? 'bg-white animate-pulse' : 'bg-red-900'}`}></span>
            </button>
        </div>
    </div>
  );
});

export default Sequencer;