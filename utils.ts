const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToNoteName = (midi: number): string => {
    if (midi < 0 || midi > 127) return "---";
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
};

export const noteNameToMidi = (name: string): number => {
    if (!name || name.length < 2) return 60;
    try {
        const octave = parseInt(name.slice(-1), 10);
        const noteStr = name.slice(0, -1).toUpperCase();
        const noteIndex = NOTE_NAMES.indexOf(noteStr);
        if (noteIndex === -1) return 60; // Default to C4 if note name is invalid
        return (octave + 1) * 12 + noteIndex;
    } catch {
        return 60;
    }
};

export const noteToFreq = (note: string): number => {
    try {
        const midiNote = noteNameToMidi(note);
        // A4 = 440 Hz, MIDI note 69
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    } catch (e) {
        console.error(`Could not parse note: ${note}`);
        return 440;
    }
};
