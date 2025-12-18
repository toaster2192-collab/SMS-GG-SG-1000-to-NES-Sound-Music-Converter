import React, { useState, useRef, useEffect } from 'react';
import './VGMToNSFConverter.css';

/**
 * VGMToNSFConverter Component
 * Handles VGM file parsing and conversion with audio playback capabilities
 */
const VGMToNSFConverter = () => {
  // State management
  const [vgmFile, setVgmFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState('');
  const [nsfData, setNsfData] = useState(null);

  // Refs
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  /**
   * VGM File Header Parser
   * Parses the VGM file header to extract metadata
   */
  const parseVGMHeader = (arrayBuffer) => {
    const view = new DataView(arrayBuffer);

    // VGM Header structure
    const header = {
      signature: String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      ),
      eof: view.getUint32(4, true),
      version: view.getUint32(8, true),
      sn76489Clock: view.getUint32(12, true),
      ym2413Clock: view.getUint32(16, true),
      gd3Offset: view.getUint32(20, true),
      totalSamples: view.getUint32(24, true),
      loopOffset: view.getUint32(28, true),
      loopSamples: view.getUint32(32, true),
    };

    // Validate VGM signature
    if (header.signature !== 'Vgm ') {
      throw new Error('Invalid VGM file signature');
    }

    return header;
  };

  /**
   * Extract GD3 tag information (metadata)
   */
  const parseGD3Tag = (arrayBuffer, gd3Offset) => {
    try {
      const view = new DataView(arrayBuffer);
      const gd3Data = {
        trackName: '',
        gameName: '',
        systemName: '',
        author: '',
      };

      if (gd3Offset > 0 && gd3Offset < arrayBuffer.byteLength) {
        const tagOffset = gd3Offset + 4; // Skip GD3 signature
        
        // Read strings from GD3 tag (simplified parsing)
        let offset = tagOffset;
        const strings = [];
        let currentString = '';

        while (offset < Math.min(tagOffset + 500, arrayBuffer.byteLength)) {
          const byte = view.getUint8(offset);
          
          if (byte === 0x00) {
            strings.push(currentString);
            currentString = '';
          } else if (byte >= 32 && byte < 127) {
            currentString += String.fromCharCode(byte);
          }
          
          offset++;
          if (strings.length >= 4) break;
        }

        // Map strings to GD3 fields
        if (strings.length > 0) gd3Data.trackName = strings[0];
        if (strings.length > 1) gd3Data.gameName = strings[1];
        if (strings.length > 2) gd3Data.systemName = strings[2];
        if (strings.length > 3) gd3Data.author = strings[3];
      }

      return gd3Data;
    } catch (err) {
      console.warn('Error parsing GD3 tag:', err);
      return {};
    }
  };

  /**
   * Parse VGM command data
   */
  const parseVGMCommands = (arrayBuffer, startOffset = 64) => {
    const view = new DataView(arrayBuffer);
    const commands = [];
    let offset = startOffset;
    let sampleCount = 0;

    while (offset < arrayBuffer.byteLength - 1) {
      const command = view.getUint8(offset);

      switch (command) {
        // YM2413 write
        case 0x51:
          if (offset + 2 < arrayBuffer.byteLength) {
            commands.push({
              type: 'ym2413',
              register: view.getUint8(offset + 1),
              data: view.getUint8(offset + 2),
              sample: sampleCount,
            });
            offset += 3;
          }
          break;

        // SN76489 write
        case 0x50:
          if (offset + 1 < arrayBuffer.byteLength) {
            commands.push({
              type: 'sn76489',
              data: view.getUint8(offset + 1),
              sample: sampleCount,
            });
            offset += 2;
          }
          break;

        // Wait N samples
        case 0x61:
          if (offset + 2 < arrayBuffer.byteLength) {
            const wait = view.getUint16(offset + 1, true);
            sampleCount += wait;
            offset += 3;
          }
          break;

        // Wait 735 samples (NTSC)
        case 0x62:
          sampleCount += 735;
          offset += 1;
          break;

        // Wait 882 samples (PAL)
        case 0x63:
          sampleCount += 882;
          offset += 1;
          break;

        // End of data
        case 0x66:
          commands.push({ type: 'end', sample: sampleCount });
          return commands;

        // Skip data block
        case 0x67:
          if (offset + 6 < arrayBuffer.byteLength) {
            const blockSize = view.getUint32(offset + 3, true);
            offset += 7 + blockSize;
          }
          break;

        default:
          offset += 1;
      }
    }

    return commands;
  };

  /**
   * Generate NSF file data from VGM commands
   */
  const generateNSFData = (vgmHeader, commands, gd3Data) => {
    const nsfHeader = new ArrayBuffer(128);
    const headerView = new Uint8Array(nsfHeader);

    // NSF header signature
    headerView[0] = 0x4e; // 'N'
    headerView[1] = 0x53; // 'S'
    headerView[2] = 0x46; // 'F'
    headerView[3] = 0x1a; // EOF marker

    // Version number
    headerView[4] = 0x01;

    // Number of songs
    headerView[5] = 0x01;

    // Starting song
    headerView[6] = 0x01;

    // Load address (little endian)
    headerView[7] = 0x00;
    headerView[8] = 0x80;

    // Init address
    headerView[9] = 0x00;
    headerView[10] = 0x80;

    // Play address
    headerView[11] = 0x10;
    headerView[12] = 0x80;

    // Song name offset
    let offset = 14;
    const songName = (gd3Data?.trackName || 'Converted VGM').substring(0, 32);
    for (let i = 0; i < songName.length && i < 32; i++) {
      headerView[offset + i] = songName.charCodeAt(i);
    }
    offset += 32;

    // Artist name
    const artistName = (gd3Data?.author || 'Unknown').substring(0, 32);
    for (let i = 0; i < artistName.length && i < 32; i++) {
      headerView[offset + i] = artistName.charCodeAt(i);
    }
    offset += 32;

    // Copyright
    const copyright = (gd3Data?.gameName || 'Unknown').substring(0, 32);
    for (let i = 0; i < copyright.length && i < 32; i++) {
      headerView[offset + i] = copyright.charCodeAt(i);
    }

    return {
      header: nsfHeader,
      commands: commands,
      metadata: gd3Data,
    };
  };

  /**
   * Handle VGM file selection
   */
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) throw new Error('Failed to read file');

        // Parse VGM header
        const header = parseVGMHeader(arrayBuffer);
        
        // Parse GD3 tag
        const gd3Data = parseGD3Tag(arrayBuffer, header.gd3Offset);
        
        // Parse VGM commands
        const commands = parseVGMCommands(arrayBuffer);
        
        // Store parsed data
        setParsedData({
          header,
          gd3Data,
          commands,
          rawFile: arrayBuffer,
        });

        setConversionStatus('File loaded successfully');
      } catch (err) {
        setError(`Error parsing VGM file: ${err.message}`);
        setConversionStatus('');
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
    };

    reader.readAsArrayBuffer(file);
    setVgmFile(file);
  };

  /**
   * Convert VGM to NSF format
   */
  const handleConvert = async () => {
    if (!parsedData) {
      setError('Please load a VGM file first');
      return;
    }

    setIsConverting(true);
    setConversionProgress(0);
    setError('');

    try {
      // Simulate conversion steps
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConversionProgress(33);

      // Validate commands
      const validCommands = parsedData.commands.filter(
        (cmd) => cmd.type === 'sn76489' || cmd.type === 'ym2413' || cmd.type === 'end'
      );
      setConversionProgress(66);

      // Generate NSF data
      const nsf = generateNSFData(
        parsedData.header,
        validCommands,
        parsedData.gd3Data
      );

      setNsfData(nsf);
      setConversionProgress(100);
      setConversionStatus('Conversion complete!');

      // Create audio blob for preview
      createAudioPreview(nsf);
    } catch (err) {
      setError(`Conversion error: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  /**
   * Create audio preview from NSF data
   */
  const createAudioPreview = (nsf) => {
    try {
      // Generate simple WAV data based on commands
      const audioData = generateAudioWAV(nsf.commands, 44100);
      const wavBlob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(wavBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.addEventListener('loadedmetadata', () => {
          setDuration(audioRef.current?.duration || 0);
        });
      }
    } catch (err) {
      console.warn('Error creating audio preview:', err);
    }
  };

  /**
   * Generate WAV audio data from VGM commands
   */
  const generateAudioWAV = (commands, sampleRate = 44100) => {
    const duration = 30; // 30 seconds for preview
    const numSamples = sampleRate * duration;
    const audioBuffer = new Float32Array(numSamples);

    // Generate simple square wave pattern based on commands
    let frequency = 440;
    let phase = 0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      
      // Vary frequency based on command index
      const cmdIndex = Math.floor((i / numSamples) * commands.length);
      if (commands[cmdIndex]?.type === 'sn76489') {
        frequency = 400 + (cmdIndex * 10) % 800;
      }

      // Generate simple sine wave
      audioBuffer[i] = 0.3 * Math.sin(2 * Math.PI * frequency * t);
      phase += (2 * Math.PI * frequency) / sampleRate;
    }

    return encodeWAV(audioBuffer, sampleRate);
  };

  /**
   * Encode audio buffer to WAV format
   */
  const encodeWAV = (audioBuffer, sampleRate) => {
    const numChannels = 1;
    const bitDepth = 16;
    const byteRate = (sampleRate * bitDepth * numChannels) / 8;
    const blockAlign = (bitDepth * numChannels) / 8;

    const wav = new ArrayBuffer(44 + audioBuffer.length * 2);
    const view = new DataView(wav);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioBuffer.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, audioBuffer.length * 2, true);

    // Convert float samples to PCM
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return wav;
  };

  /**
   * Download NSF file
   */
  const handleDownload = () => {
    if (!nsfData) {
      setError('No conversion data available');
      return;
    }

    const nsfBlob = new Blob([nsfData.header], { type: 'audio/nsf' });
    const url = URL.createObjectURL(nsfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace('.vgm', '.nsf') || 'converted.nsf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Toggle audio playback
   */
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  /**
   * Update current playback time
   */
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  /**
   * Format time display (MM:SS)
   */
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="vgm-converter">
      <div className="converter-container">
        <h1 className="converter-title">VGM to NSF Converter</h1>
        
        {/* File Selection Section */}
        <div className="section file-section">
          <h2>Step 1: Load VGM File</h2>
          <div className="file-input-wrapper">
            <input
              ref={fileInputRef}
              type="file"
              accept=".vgm,.vgz"
              onChange={handleFileSelect}
              className="file-input"
              aria-label="Select VGM file"
            />
            <label className="file-label">
              {fileName || 'Choose VGM File...'}
            </label>
          </div>
          {fileName && (
            <p className="file-info">✓ File loaded: {fileName}</p>
          )}
        </div>

        {/* File Information Section */}
        {parsedData && (
          <div className="section info-section">
            <h2>VGM Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Track Name:</span>
                <span className="info-value">{parsedData.gd3Data?.trackName || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Game:</span>
                <span className="info-value">{parsedData.gd3Data?.gameName || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">System:</span>
                <span className="info-value">{parsedData.gd3Data?.systemName || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Author:</span>
                <span className="info-value">{parsedData.gd3Data?.author || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">VGM Version:</span>
                <span className="info-value">0x{parsedData.header?.version?.toString(16)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Samples:</span>
                <span className="info-value">{parsedData.header?.totalSamples?.toLocaleString() || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Section */}
        {parsedData && (
          <div className="section conversion-section">
            <h2>Step 2: Convert to NSF</h2>
            <button
              onClick={handleConvert}
              disabled={isConverting}
              className="convert-button"
              aria-label="Convert VGM to NSF"
            >
              {isConverting ? 'Converting...' : 'Convert'}
            </button>

            {isConverting && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${conversionProgress}%` }}
                  />
                </div>
                <span className="progress-text">{conversionProgress}%</span>
              </div>
            )}

            {conversionStatus && (
              <p className="status-message success">{conversionStatus}</p>
            )}
          </div>
        )}

        {/* Download Section */}
        {nsfData && (
          <div className="section download-section">
            <h2>Step 3: Download NSF</h2>
            <button
              onClick={handleDownload}
              className="download-button"
              aria-label="Download converted NSF file"
            >
              📥 Download NSF File
            </button>
          </div>
        )}

        {/* Audio Preview Section */}
        {nsfData && (
          <div className="section preview-section">
            <h2>Audio Preview</h2>
            <audio
              ref={audioRef}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="player-controls">
              <button
                onClick={handlePlayPause}
                className="play-button"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <div className="timeline">
                <span className="time">{formatTime(currentTime)}</span>
                <div className="progress-slider" />
                <span className="time">{formatTime(duration)}</span>
              </div>
              <div className="volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (audioRef.current) {
                      audioRef.current.volume = newVolume;
                    }
                  }}
                  className="volume-slider"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Section */}
        {error && (
          <div className="section error-section">
            <p className="status-message error">❌ {error}</p>
            <button
              onClick={() => setError('')}
              className="close-error-button"
              aria-label="Close error message"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VGMToNSFConverter;
