import React, { useState, useCallback } from 'react';
import VGMToNSFConverter from './components/VGMToNSFConverter';
import './App.css';

const App = () => {
  // System selection state
  const [selectedSystem, setSelectedSystem] = useState('SMS');
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  
  // Conversion state
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionError, setConversionError] = useState(null);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [convertedFile, setConvertedFile] = useState(null);
  
  // Workflow state
  const [workflowStep, setWorkflowStep] = useState('system-select'); // system-select -> file-upload -> conversion -> complete

  // Supported systems configuration
  const SUPPORTED_SYSTEMS = [
    { id: 'SMS', name: 'Sega Master System', extension: '.vgm' },
    { id: 'GG', name: 'Game Gear', extension: '.vgm' },
    { id: 'SG-1000', name: 'SG-1000', extension: '.vgm' },
    { id: 'GB', name: 'Game Boy', extension: '.vgm' },
    { id: 'MSX', name: 'MSX', extension: '.vgm' },
  ];

  /**
   * Handle system selection
   */
  const handleSystemSelect = useCallback((systemId) => {
    setSelectedSystem(systemId);
    setWorkflowStep('file-upload');
    // Reset previous uploads/conversions when changing system
    setUploadedFile(null);
    setConvertedFile(null);
    setConversionComplete(false);
    setUploadError(null);
    setConversionError(null);
  }, []);

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      setUploadError(null);
      return;
    }

    // Validate file type
    const validExtensions = ['.vgm', '.VGM'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      setUploadError(`Invalid file type. Please upload a .vgm file for ${selectedSystem}.`);
      setUploadedFile(null);
      return;
    }

    // Validate file size (max 10MB)
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setUploadError('File size exceeds 10MB limit. Please choose a smaller file.');
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    setUploadError(null);
  }, [selectedSystem]);

  /**
   * Handle conversion start
   */
  const handleConversionStart = useCallback(async () => {
    if (!uploadedFile) {
      setConversionError('No file selected for conversion.');
      return;
    }

    setIsConverting(true);
    setConversionError(null);
    setConversionProgress(0);
    setWorkflowStep('conversion');

    try {
      // Simulate conversion progress
      const progressInterval = setInterval(() => {
        setConversionProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 20;
        });
      }, 500);

      // Call VGMToNSFConverter component or conversion API
      // This would typically call your backend conversion service
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('system', selectedSystem);

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName = `${uploadedFile.name.replace('.vgm', '')}.nsf`;
      
      setConvertedFile({ url, fileName });
      setConversionProgress(100);
      setConversionComplete(true);
      setWorkflowStep('complete');
    } catch (error) {
      console.error('Conversion error:', error);
      setConversionError(error.message || 'An error occurred during conversion. Please try again.');
      setIsConverting(false);
      setWorkflowStep('file-upload');
    } finally {
      setIsConverting(false);
    }
  }, [uploadedFile, selectedSystem]);

  /**
   * Handle download of converted file
   */
  const handleDownload = useCallback(() => {
    if (!convertedFile) return;

    const link = document.createElement('a');
    link.href = convertedFile.url;
    link.download = convertedFile.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(convertedFile.url);
  }, [convertedFile]);

  /**
   * Handle reset to start new conversion
   */
  const handleReset = useCallback(() => {
    setSelectedSystem('SMS');
    setUploadedFile(null);
    setUploadError(null);
    setIsConverting(false);
    setConversionProgress(0);
    setConversionError(null);
    setConversionComplete(false);
    setConvertedFile(null);
    setWorkflowStep('system-select');
  }, []);

  /**
   * Handle back navigation in workflow
   */
  const handleGoBack = useCallback(() => {
    if (workflowStep === 'file-upload') {
      setWorkflowStep('system-select');
      setUploadedFile(null);
      setUploadError(null);
    } else if (workflowStep === 'conversion') {
      if (!isConverting) {
        setWorkflowStep('file-upload');
        setConversionProgress(0);
        setConversionError(null);
      }
    } else if (workflowStep === 'complete') {
      handleReset();
    }
  }, [workflowStep, isConverting, handleReset]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>VGM to NSF Converter</h1>
        <p className="app-subtitle">Convert SMS, GG, SG-1000, GB, and MSX game audio to NES format</p>
      </header>

      <main className="app-main">
        {/* System Selection Step */}
        {workflowStep === 'system-select' && (
          <div className="workflow-step system-select-step">
            <h2>Step 1: Select Your Gaming System</h2>
            <div className="systems-grid">
              {SUPPORTED_SYSTEMS.map((system) => (
                <button
                  key={system.id}
                  className={`system-button ${selectedSystem === system.id ? 'active' : ''}`}
                  onClick={() => handleSystemSelect(system.id)}
                  aria-label={`Select ${system.name}`}
                >
                  <div className="system-icon">{system.id}</div>
                  <div className="system-name">{system.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File Upload Step */}
        {workflowStep === 'file-upload' && (
          <div className="workflow-step file-upload-step">
            <h2>Step 2: Upload VGM File</h2>
            <p className="system-info">
              Selected System: <strong>{SUPPORTED_SYSTEMS.find(s => s.id === selectedSystem)?.name}</strong>
            </p>

            <div className="upload-container">
              <div className="upload-area">
                <input
                  type="file"
                  accept=".vgm"
                  onChange={handleFileUpload}
                  id="file-input"
                  className="file-input"
                  disabled={isConverting}
                />
                <label htmlFor="file-input" className="upload-label">
                  <div className="upload-icon">📁</div>
                  <p className="upload-text">
                    {uploadedFile ? uploadedFile.name : 'Click to select or drag and drop your .vgm file'}
                  </p>
                  <p className="upload-subtext">Maximum file size: 10MB</p>
                </label>
              </div>

              {uploadError && (
                <div className="error-message" role="alert">
                  ⚠️ {uploadError}
                </div>
              )}

              {uploadedFile && (
                <div className="file-info">
                  <p className="file-name">📄 {uploadedFile.name}</p>
                  <p className="file-size">Size: {(uploadedFile.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </div>

            <div className="button-group">
              <button
                className="btn btn-secondary"
                onClick={handleGoBack}
                disabled={isConverting}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConversionStart}
                disabled={!uploadedFile || isConverting}
              >
                {isConverting ? 'Converting...' : 'Start Conversion'}
              </button>
            </div>
          </div>
        )}

        {/* Conversion Step */}
        {workflowStep === 'conversion' && (
          <div className="workflow-step conversion-step">
            <h2>Step 3: Converting Audio</h2>

            <div className="conversion-info">
              <p className="conversion-file">File: <strong>{uploadedFile?.name}</strong></p>
              <p className="conversion-system">System: <strong>{SUPPORTED_SYSTEMS.find(s => s.id === selectedSystem)?.name}</strong></p>
            </div>

            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${conversionProgress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(conversionProgress)}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <p className="progress-text">{Math.round(conversionProgress)}%</p>
            </div>

            {/* VGMToNSFConverter Component Integration */}
            <div className="converter-component">
              <VGMToNSFConverter
                file={uploadedFile}
                system={selectedSystem}
                onProgress={setConversionProgress}
                onComplete={(file) => {
                  setConvertedFile(file);
                  setConversionComplete(true);
                  setWorkflowStep('complete');
                }}
                onError={(error) => {
                  setConversionError(error);
                  setWorkflowStep('file-upload');
                }}
              />
            </div>

            {conversionError && (
              <div className="error-message" role="alert">
                ⚠️ {conversionError}
              </div>
            )}

            {!isConverting && !conversionComplete && (
              <div className="button-group">
                <button
                  className="btn btn-secondary"
                  onClick={handleGoBack}
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        )}

        {/* Completion Step */}
        {workflowStep === 'complete' && conversionComplete && (
          <div className="workflow-step complete-step">
            <div className="success-indicator">
              <div className="success-icon">✓</div>
              <h2>Conversion Complete!</h2>
            </div>

            {convertedFile && (
              <div className="completion-info">
                <p className="completion-text">Your file has been successfully converted.</p>
                <div className="file-result">
                  <p className="result-label">Converted File:</p>
                  <p className="result-file">{convertedFile.fileName}</p>
                </div>
              </div>
            )}

            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleDownload}
                disabled={!convertedFile}
              >
                📥 Download File
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleReset}
              >
                ↻ Convert Another
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 VGM to NSF Converter. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
