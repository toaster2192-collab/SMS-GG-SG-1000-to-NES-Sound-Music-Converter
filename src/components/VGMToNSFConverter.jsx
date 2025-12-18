import React, { useState } from 'react';
import './VGMToNSFConverter.css';

const VGMToNSFConverter = () => {
  const [vgmData, setVgmData] = useState(null);
  const [nsfData, setNsfData] = useState(null);
  const [convertedAudio, setConvertedAudio] = useState(null);
  const [conversionStatus, setConversionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [conversionOptions, setConversionOptions] = useState({
    preserveNoise: true,
    enablePCM: true,
    detectLoops: true,
    loopThreshold: 0.85,
  });

  // Enhanced SN76489 to NES APU frequency mapping
  const sn76489ToNESFrequencyMap = {
    noise: {
      // Noise channel mapping for SMS/GG
      white: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07],
      periodic: [0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F],
    },
    tone: {
      // Frequency mapping for tone channels
      baseFrequencies: generateNESFrequencies(),
    },
  };

  // Generate NES APU frequencies
  function generateNESFrequencies() {
    const frequencies = [];
    for (let i = 0; i < 2048; i++) {
      frequencies.push(1789773 / (16 * (i + 1)));
    }
    return frequencies;
  }

  // Parse VGM file header and data
  const parseVGMFile = (buffer) => {
    try {
      const view = new DataView(buffer);
      
      // VGM header validation
      const signature = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );

      if (signature !== 'Vgm ') {
        throw new Error('Invalid VGM file signature');
      }

      const vgmVersion = view.getUint32(8, true);
      const sn76489Clock = view.getUint32(12, true);
      const ym2413Clock = view.getUint32(16, true);
      const gd3Offset = view.getUint32(20, true);
      const totalSamples = view.getUint32(24, true);
      const loopOffset = view.getUint32(28, true);
      const loopSamples = view.getUint32(32, true);
      const dataOffset = view.getUint32(52, true) || 0x40;

      return {
        version: vgmVersion,
        sn76489Clock: sn76489Clock || 3579545,
        ym2413Clock: ym2413Clock || 0,
        totalSamples,
        loopOffset,
        loopSamples,
        dataOffset: dataOffset + 0x34,
        buffer,
      };
    } catch (error) {
      throw new Error(`VGM parsing error: ${error.message}`);
    }
  };

  // Enhanced SMS noise channel mapping
  const mapSMSNoiseToNES = (noiseData) => {
    const nesNoiseData = [];
    
    for (let i = 0; i < noiseData.length; i++) {
      const smsNoiseByte = noiseData[i];
      const noiseType = (smsNoiseByte >> 2) & 0x01; // White or periodic
      const noisePeriod = smsNoiseByte & 0x03;
      
      // Map SMS noise to NES noise channel register
      const nesNoiseRegister = (noiseType << 7) | (noisePeriod & 0x0F);
      nesNoiseData.push(nesNoiseRegister);
    }
    
    return nesNoiseData;
  };

  // PCM/DPCM support with compression
  const handlePCMConversion = (pcmData) => {
    if (!conversionOptions.enablePCM) {
      return null;
    }

    const dpcmData = [];
    let previousSample = 0;

    // Convert PCM to DPCM (Delta PCM)
    for (let i = 0; i < pcmData.length; i += 8) {
      let dpcmByte = 0;

      for (let bit = 0; bit < 8 && i + bit < pcmData.length; bit++) {
        const currentSample = pcmData[i + bit];
        const delta = currentSample - previousSample;
        
        // Encode delta as single bit
        if (Math.abs(delta) > 0) {
          dpcmByte |= (1 << bit);
        }
        
        previousSample = currentSample;
      }

      dpcmData.push(dpcmByte);
    }

    return dpcmData;
  };

  // Advanced loop detection
  const detectLoops = (audioData) => {
    if (!conversionOptions.detectLoops) {
      return null;
    }

    const threshold = conversionOptions.loopThreshold;
    const correlationResults = [];

    for (let offset = 100; offset < audioData.length / 2; offset += 100) {
      let correlation = 0;
      let matchingPoints = 0;

      for (let i = 0; i < audioData.length - offset; i++) {
        if (Math.abs(audioData[i] - audioData[i + offset]) < 10) {
          correlation += Math.pow(1 - Math.abs(audioData[i] - audioData[i + offset]) / 127, 2);
          matchingPoints++;
        }
      }

      const correlationScore = matchingPoints > 0 ? correlation / matchingPoints : 0;

      if (correlationScore > threshold) {
        correlationResults.push({
          offset,
          correlation: correlationScore,
          matchingPoints,
        });
      }
    }

    return correlationResults.length > 0 ? correlationResults[0] : null;
  };

  // Parse VGM commands and convert to NSF-compatible format
  const parseVGMCommands = (vgmData) => {
    const buffer = vgmData.buffer;
    const view = new DataView(buffer);
    const commands = [];
    let offset = vgmData.dataOffset;
    let sampleCounter = 0;

    while (offset < buffer.byteLength && commands.length < 10000) {
      const command = view.getUint8(offset);

      switch (command) {
        case 0x4F: // GG Stereo
          offset += 2;
          break;

        case 0x50: // PSG (SN76489) write
          {
            const data = view.getUint8(offset + 1);
            const channel = (data >> 5) & 0x03;
            
            if (channel === 3) {
              // Noise channel
              if (conversionOptions.preserveNoise) {
                commands.push({
                  type: 'noise',
                  data: data,
                  sample: sampleCounter,
                });
              }
            } else {
              // Tone channels
              commands.push({
                type: 'tone',
                channel,
                data,
                sample: sampleCounter,
              });
            }
            offset += 2;
          }
          break;

        case 0x61: // Wait
          {
            const waitSamples = view.getUint16(offset + 1, true);
            sampleCounter += waitSamples;
            offset += 3;
          }
          break;

        case 0x62: // Wait 735 samples (NTSC)
          sampleCounter += 735;
          offset += 1;
          break;

        case 0x63: // Wait 882 samples (PAL)
          sampleCounter += 882;
          offset += 1;
          break;

        case 0x66: // End of sound data
          commands.push({
            type: 'end',
            sample: sampleCounter,
          });
          offset = buffer.byteLength;
          break;

        case 0x67: // Data block
          {
            const dataType = view.getUint8(offset + 1);
            const blockSize = view.getUint32(offset + 2, true);
            
            if (dataType === 0x00 && conversionOptions.enablePCM) {
              // PCM data block
              const pcmData = new Uint8Array(buffer, offset + 6, blockSize);
              const dpcmData = handlePCMConversion(pcmData);
              
              commands.push({
                type: 'pcm',
                data: dpcmData,
                sample: sampleCounter,
              });
            }
            
            offset += 6 + blockSize;
          }
          break;

        default:
          offset += 1;
      }
    }

    return commands;
  };

  // Convert parsed commands to NSF format
  const commandsToNSF = (commands, vgmData) => {
    const nsfTracks = {
      square1: [],
      square2: [],
      triangle: [],
      noise: [],
      dpcm: [],
    };

    let loopPoint = null;
    if (conversionOptions.detectLoops) {
      loopPoint = detectLoops(commands);
    }

    commands.forEach((cmd) => {
      switch (cmd.type) {
        case 'tone':
          {
            const period = cmd.data & 0x3F;
            const volume = (cmd.data >> 4) & 0x0F;
            
            if (cmd.channel === 0) {
              nsfTracks.square1.push({
                period,
                volume,
                sample: cmd.sample,
              });
            } else if (cmd.channel === 1) {
              nsfTracks.square2.push({
                period,
                volume,
                sample: cmd.sample,
              });
            }
          }
          break;

        case 'noise':
          {
            if (conversionOptions.preserveNoise) {
              const nesNoise = mapSMSNoiseToNES([cmd.data]);
              nsfTracks.noise.push({
                register: nesNoise[0],
                sample: cmd.sample,
              });
            }
          }
          break;

        case 'pcm':
          {
            if (conversionOptions.enablePCM && cmd.data) {
              nsfTracks.dpcm.push({
                data: cmd.data,
                sample: cmd.sample,
              });
            }
          }
          break;

        case 'end':
          {
            nsfTracks.loopPoint = loopPoint;
            nsfTracks.totalSamples = cmd.sample;
          }
          break;

        default:
          break;
      }
    });

    return nsfTracks;
  };

  // Build NSF file
  const buildNSFFile = (nsfTracks) => {
    const nsfHeader = new Uint8Array(128);
    const view = new DataView(nsfHeader.buffer);

    // NSF header
    nsfHeader.set(new TextEncoder().encode('NESM\x1A'), 0); // Signature
    view.setUint8(5, 0x01); // Version
    view.setUint8(6, 1); // Number of songs
    view.setUint8(7, 1); // Starting song

    // Load address (0x8000)
    view.setUint16(8, 0x8000, true);
    
    // Init address (0x8003)
    view.setUint16(10, 0x8003, true);
    
    // Play address (0x8006)
    view.setUint16(12, 0x8006, true);

    // Song name, artist, copyright (32 bytes each)
    nsfHeader.set(new TextEncoder().encode('Converted VGM'), 14);
    nsfHeader.set(new TextEncoder().encode('VGM Converter'), 46);
    nsfHeader.set(new TextEncoder().encode('Original VGM Author'), 78);

    // PAL/NTSC flags
    view.setUint8(100, 0x00); // NTSC
    view.setUint8(101, 0x00); // PAL (disabled)

    // Chip support flags
    view.setUint8(102, 0x00); // Extra sound chips

    // Expansion chip
    view.setUint8(103, 0x00); // No expansion

    return nsfHeader;
  };

  // Main conversion function
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setConversionStatus('processing');
    setErrorMessage('');

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseVGMFile(buffer);
      setVgmData(parsed);

      const commands = parseVGMCommands(parsed);
      const nsfTracks = commandsToNSF(commands, parsed);
      setNsfData(nsfTracks);

      const nsfHeader = buildNSFFile(nsfTracks);
      setConvertedAudio(nsfHeader);

      setConversionStatus('complete');
    } catch (error) {
      setErrorMessage(`Conversion failed: ${error.message}`);
      setConversionStatus('error');
    }
  };

  // Download NSF file
  const downloadNSF = () => {
    if (!convertedAudio) return;

    const blob = new Blob([convertedAudio], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.nsf';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="vgm-to-nsf-container">
      <h1>VGM to NSF Converter</h1>
      <p className="subtitle">Enhanced SN76489 to NES APU Conversion with Noise Channel, PCM Handling, and Loop Detection</p>

      <div className="converter-section">
        <h2>Conversion Options</h2>
        <div className="options-grid">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={conversionOptions.preserveNoise}
              onChange={(e) =>
                setConversionOptions({
                  ...conversionOptions,
                  preserveNoise: e.target.checked,
                })
              }
            />
            <span>Preserve SMS Noise Channel</span>
          </label>

          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={conversionOptions.enablePCM}
              onChange={(e) =>
                setConversionOptions({
                  ...conversionOptions,
                  enablePCM: e.target.checked,
                })
              }
            />
            <span>Enable PCM/DPCM Support</span>
          </label>

          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={conversionOptions.detectLoops}
              onChange={(e) =>
                setConversionOptions({
                  ...conversionOptions,
                  detectLoops: e.target.checked,
                })
              }
            />
            <span>Detect Audio Loops</span>
          </label>

          {conversionOptions.detectLoops && (
            <div className="threshold-control">
              <label>Loop Threshold: {(conversionOptions.loopThreshold * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={conversionOptions.loopThreshold}
                onChange={(e) =>
                  setConversionOptions({
                    ...conversionOptions,
                    loopThreshold: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="converter-section">
        <h2>Upload VGM File</h2>
        <input
          type="file"
          accept=".vgm"
          onChange={handleFileUpload}
          className="file-input"
        />
      </div>

      {vgmData && (
        <div className="converter-section">
          <h2>VGM File Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>VGM Version:</label>
              <span>0x{vgmData.version.toString(16)}</span>
            </div>
            <div className="info-item">
              <label>SN76489 Clock:</label>
              <span>{(vgmData.sn76489Clock / 1000000).toFixed(2)} MHz</span>
            </div>
            <div className="info-item">
              <label>Total Samples:</label>
              <span>{vgmData.totalSamples.toLocaleString()}</span>
            </div>
            <div className="info-item">
              <label>Loop Samples:</label>
              <span>{vgmData.loopSamples.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {nsfData && (
        <div className="converter-section">
          <h2>Conversion Results</h2>
          <div className="results-grid">
            <div className="result-item">
              <label>Square 1 Commands:</label>
              <span>{nsfData.square1.length}</span>
            </div>
            <div className="result-item">
              <label>Square 2 Commands:</label>
              <span>{nsfData.square2.length}</span>
            </div>
            <div className="result-item">
              <label>Noise Commands:</label>
              <span>{nsfData.noise.length}</span>
            </div>
            <div className="result-item">
              <label>DPCM Blocks:</label>
              <span>{nsfData.dpcm.length}</span>
            </div>
            {nsfData.loopPoint && (
              <div className="result-item">
                <label>Loop Detected:</label>
                <span>Offset: {nsfData.loopPoint.offset} samples</span>
              </div>
            )}
            <div className="result-item">
              <label>Total Samples:</label>
              <span>{nsfData.totalSamples ? nsfData.totalSamples.toLocaleString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {conversionStatus === 'complete' && (
        <div className="converter-section">
          <h2>Download</h2>
          <button onClick={downloadNSF} className="download-button">
            Download NSF File
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="error-message">
          <h3>Error</h3>
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="conversion-status">
        <p>Status: <span className={`status-${conversionStatus}`}>{conversionStatus}</span></p>
      </div>
    </div>
  );
};

export default VGMToNSFConverter;
