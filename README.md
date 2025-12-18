# SMS/GG/SG-1000 to NES Sound & Music Converter

A specialized tool for converting audio and music files from Sega Master System (SMS), Game Gear (GG), and SG-1000 formats to NES-compatible sound and music formats.

## Project Overview

This converter enables retro gaming enthusiasts and developers to transform audio assets from classic Sega gaming systems into formats compatible with the Nintendo Entertainment System (NES). The tool handles the technical complexities of cross-platform audio conversion, including frequency adjustment, sample rate conversion, and format translation.

### Key Features

- **Multi-Format Support**: Convert audio from SMS, Game Gear, and SG-1000 platforms
- **NES-Compatible Output**: Generate sound effects and music in NES-native formats
- **Batch Processing**: Convert multiple files in a single operation
- **Frequency Optimization**: Automatic adjustment for NES hardware constraints
- **Quality Preservation**: Maintains audio quality within NES limitations

## Installation & Setup

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Python 3.8+** - The primary runtime environment
- **Git** - For cloning and version control
- **pip** - Python package manager (included with Python 3.8+)

### Clone the Repository

```bash
git clone https://github.com/toaster2192-collab/SMS-GG-SG-1000-to-NES-Sound-Music-Converter.git
cd SMS-GG-SG-1000-to-NES-Sound-Music-Converter
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

If you don't have a `requirements.txt` file yet, you can create one or install core dependencies:

```bash
pip install numpy scipy
```

### Verify Installation

```bash
python --version
pip list
```

## Usage

### Basic Conversion

Convert a single audio file:

```bash
python converter.py --input input_audio.wav --output output_audio.nes
```

### Batch Processing

Convert multiple files at once:

```bash
python converter.py --input-dir ./sega_audio --output-dir ./nes_audio
```

### Advanced Options

```bash
python converter.py --input input_audio.wav \
                     --output output_audio.nes \
                     --sample-rate 44100 \
                     --format nes_dmg \
                     --quality high
```

#### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--input` | Input audio file path | Required |
| `--output` | Output audio file path | Required |
| `--input-dir` | Directory containing input files | Optional |
| `--output-dir` | Directory for output files | Optional |
| `--sample-rate` | Target sample rate in Hz | 44100 |
| `--format` | Output format (nes, nes_dmg) | nes |
| `--quality` | Conversion quality (low, medium, high) | high |

## Project Structure

```
SMS-GG-SG-1000-to-NES-Sound-Music-Converter/
├── README.md                 # Project documentation
├── requirements.txt          # Python dependencies
├── converter.py              # Main conversion script
├── src/
│   ├── __init__.py
│   ├── formats.py           # Format definitions and handlers
│   ├── audio_processor.py   # Audio processing utilities
│   └── converter_engine.py  # Core conversion logic
├── tests/
│   ├── __init__.py
│   └── test_converter.py    # Unit tests
├── samples/                 # Example input/output files
└── docs/
    ├── ARCHITECTURE.md      # Technical architecture
    ├── FORMAT_SPECS.md      # Format specifications
    └── TROUBLESHOOTING.md   # Troubleshooting guide
```

## Supported Formats

### Input Formats
- SMS PSG (Programmable Sound Generator)
- Game Gear audio files
- SG-1000 sound data
- Standard WAV files (16-bit, PCM)

### Output Formats
- NES 2A03 format
- NES DMG format
- Standard WAV (NES-compatible)

## Technical Details

### Audio Conversion Process

1. **Input Parsing**: Analyzes source audio format and parameters
2. **Frequency Mapping**: Converts source frequency to NES-compatible range
3. **Sample Rate Adjustment**: Resamples audio to appropriate rate
4. **Data Encoding**: Encodes audio in NES-compatible format
5. **Output Generation**: Creates final NES-format audio file

### Hardware Limitations Considered

- NES CPU clock frequency: 1.79 MHz (NTSC)
- PSG frequency range: 31.25 Hz to 31.25 kHz
- Sample resolution: 8-bit depth
- Channel limitations: Support for multiple channels with mixing

## Contributing

We welcome contributions to improve this converter! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/SMS-GG-SG-1000-to-NES-Sound-Music-Converter.git

# Install in development mode
pip install -e .
pip install -r requirements-dev.txt
```

### Running Tests

```bash
pytest tests/
```

## Troubleshooting

### Common Issues

**Issue**: Import errors when running the converter
- **Solution**: Ensure all dependencies are installed with `pip install -r requirements.txt`

**Issue**: Output audio quality is poor
- **Solution**: Try using `--quality high` and ensure input files are in supported formats

**Issue**: Conversion fails with format error
- **Solution**: Verify input file format and check documentation in `docs/FORMAT_SPECS.md`

For more detailed troubleshooting, see `docs/TROUBLESHOOTING.md`

## Performance Considerations

- **Batch Processing**: Processing multiple files in batch mode is significantly faster than individual conversions
- **Quality Settings**: Higher quality settings increase conversion time but produce better results
- **Memory Usage**: Large audio files may require substantial RAM; monitor system resources

## Known Limitations

- Maximum input file size: 500MB (configurable)
- Sample rate must be between 8kHz and 96kHz
- Stereo to mono conversion may result in some audio information loss
- Real-time conversion is not supported in current version

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Sega sound hardware specifications and technical documentation
- NES audio architecture references
- Community feedback and contributions

## Support & Contact

For questions, bug reports, or feature requests:

- Open an issue on GitHub
- Check existing documentation in the `docs/` folder
- Review the troubleshooting guide for common solutions

## Changelog

### Version 1.0.0 (Initial Release)
- Initial converter implementation
- Support for SMS, GG, and SG-1000 formats
- NES format output
- Batch processing capability
- Basic quality presets

---

**Last Updated**: December 18, 2025

For the latest updates and releases, visit the [GitHub Repository](https://github.com/toaster2192-collab/SMS-GG-SG-1000-to-NES-Sound-Music-Converter)
