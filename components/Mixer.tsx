import React from 'react';
import { Track } from '../types';
import Knob from './Knob';

interface MixerProps {
    tracks: Track[];
    mutedTracks: Set<number>;
    soloedTrackId: number | null;
    onVolumeChange: (trackId: number, volume: number) => void;
    onMuteToggle: (trackId: number) => void;
    onSoloToggle: (trackId: number) => void;
    onFxSendChange: (trackId: number, fx: 'reverb' | 'delay' | 'drive', value: number) => void;
}

const Mixer: React.FC<MixerProps> = ({ 
    tracks, mutedTracks, soloedTrackId, 
    onVolumeChange, onMuteToggle, onSoloToggle, onFxSendChange
}) => {
    return (
        <div className="h-full w-full p-2 grid grid-cols-8 gap-2 bg-black/20 rounded pt-4">
            {tracks.map(track => {
                const isMuted = mutedTracks.has(track.id);
                const isSoloed = soloedTrackId === track.id;
                
                const isAudible = soloedTrackId === null ? !isMuted : isSoloed;
                
                return (
                    <div key={track.id} className={`h-full flex flex-col items-center space-y-3 p-2 bg-gray-900/30 border border-black/50 rounded-md transition-opacity duration-300 ${isAudible ? 'opacity-100' : 'opacity-40'}`}>
                        <div className="flex-shrink-0 text-center">
                            <h3 className="font-bold text-sm uppercase" style={{color: 'var(--accent-color)'}}>{track.name}</h3>
                        </div>
                        
                        <div className="flex-grow flex flex-col items-center justify-around w-full">
                            <Knob 
                                label="VOLUME"
                                value={track.volume}
                                min={0} max={2.0} step={0.01}
                                onChange={(v) => onVolumeChange(track.id, v)}
                                size={45}
                            />
                             <Knob 
                                label="REVERB"
                                value={track.fxSends.reverb}
                                min={0} max={1} step={0.01}
                                onChange={(v) => onFxSendChange(track.id, 'reverb', v)}
                                size={35}
                            />
                             <Knob 
                                label="DELAY"
                                value={track.fxSends.delay}
                                min={0} max={1} step={0.01}
                                onChange={(v) => onFxSendChange(track.id, 'delay', v)}
                                size={35}
                            />
                             <Knob 
                                label="DRIVE"
                                value={track.fxSends.drive}
                                min={0} max={1} step={0.01}
                                onChange={(v) => onFxSendChange(track.id, 'drive', v)}
                                size={35}
                            />
                        </div>

                        <div className="flex-shrink-0 flex space-x-1 w-full">
                            <button 
                                onClick={() => onMuteToggle(track.id)}
                                className={`w-1/2 py-1.5 rounded font-bold text-xs border transition-all ${isMuted 
                                    ? 'bg-red-600 border-red-700 text-white shadow-[inset_0_2px_3px_rgba(0,0,0,0.6)] ring-1 ring-red-400' 
                                    : 'bg-gray-700/80 border-black/50 hover:bg-gray-700 text-gray-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'}`}
                            >
                                M
                            </button>
                            <button 
                                onClick={() => onSoloToggle(track.id)}
                                className={`w-1/2 py-1.5 rounded font-bold text-xs border transition-all ${isSoloed 
                                    ? 'bg-yellow-500 border-yellow-600 text-black shadow-[inset_0_2px_3px_rgba(0,0,0,0.6)] ring-1 ring-yellow-300' 
                                    : 'bg-gray-700/80 border-black/50 hover:bg-gray-700 text-gray-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'}`}
                            >
                                S
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

export default React.memo(Mixer);