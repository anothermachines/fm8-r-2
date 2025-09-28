// --- AudioBuffer to WAV conversion utility (32-bit float) ---

function setUint16(dataView: DataView, offset: number, value: number) {
    dataView.setUint16(offset, value, true);
}

function setUint32(dataView: DataView, offset: number, value: number) {
    dataView.setUint32(offset, value, true);
}

function writeString(dataView: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        dataView.setUint8(offset + i, str.charCodeAt(i));
    }
}

export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const bitsPerSample = 32; // 32-bit float
    const audioFormat = 3; // 3 = IEEE float

    const dataSize = numChannels * numSamples * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    
    const headerSize = 44;
    const bufferSize = headerSize + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    setUint32(view, 4, 36 + dataSize);
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    setUint32(view, 16, 16); // Sub-chunk size for PCM
    setUint16(view, 20, audioFormat);
    setUint16(view, 22, numChannels);
    setUint32(view, 24, sampleRate);
    setUint32(view, 28, byteRate);
    setUint16(view, 32, blockAlign);
    setUint16(view, 34, bitsPerSample);

    // "data" sub-chunk
    writeString(view, 36, 'data');
    setUint32(view, 40, dataSize);

    // Write the PCM data
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        for (let j = 0; j < numChannels; j++) {
            view.setFloat32(offset, channels[j][i], true);
            offset += 4;
        }
    }

    return arrayBuffer;
}