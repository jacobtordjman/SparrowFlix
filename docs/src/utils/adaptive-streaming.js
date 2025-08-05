// docs/src/utils/adaptive-streaming.js - Client-side Adaptive Streaming (Phase 4.2)

/**
 * Adaptive Streaming Manager for SparrowFlix
 * Handles bandwidth detection, quality selection, and smooth quality transitions
 * Works with HLS streams from free-tier CDN and Telegram fallback
 */

export class AdaptiveStreamingManager {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.options = {
      initialQuality: 'auto',
      bufferLength: 30, // seconds
      maxBufferLength: 60, // seconds
      bandwidthSamples: 10,
      switchThreshold: 0.2, // 20% bandwidth change needed to switch
      qualityCheckInterval: 5000, // 5 seconds
      ...options
    };

    // Quality levels (synced with server)
    this.qualityLevels = [
      { name: '360p', bandwidth: 800000, width: 640, height: 360 },
      { name: '720p', bandwidth: 2500000, width: 1280, height: 720 },
      { name: '1080p', bandwidth: 5000000, width: 1920, height: 1080 }
    ];

    // State management
    this.currentQuality = null;
    this.targetQuality = null;
    this.bandwidthHistory = [];
    this.isAdaptiveEnabled = true;
    this.qualityLocked = false;
    
    // Performance tracking
    this.downloadStats = new Map();
    this.bufferHealth = [];
    this.stallCount = 0;
    
    // Initialize
    this.init();
  }

  /**
   * Initialize adaptive streaming
   */
  async init() {
    try {
      // Detect initial bandwidth
      await this.detectBandwidth();
      
      // Select initial quality
      this.currentQuality = this.selectOptimalQuality();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start quality monitoring
      this.startQualityMonitoring();
      
      console.log('Adaptive streaming initialized:', {
        quality: this.currentQuality,
        bandwidth: this.getAverageBandwidth()
      });

    } catch (error) {
      console.error('Failed to initialize adaptive streaming:', error);
      // Fallback to medium quality
      this.currentQuality = '720p';
    }
  }

  /**
   * Detect user's bandwidth using test downloads
   */
  async detectBandwidth() {
    const testSizes = [100000, 500000, 1000000]; // 100KB, 500KB, 1MB
    const results = [];

    for (const size of testSizes) {
      try {
        const bandwidth = await this.performBandwidthTest(size);
        if (bandwidth > 0) {
          results.push(bandwidth);
        }
      } catch (error) {
        console.warn('Bandwidth test failed:', error);
      }
    }

    if (results.length > 0) {
      const avgBandwidth = results.reduce((sum, bw) => sum + bw, 0) / results.length;
      this.addBandwidthSample(avgBandwidth);
    }
  }

  /**
   * Perform single bandwidth test
   * @param {number} testSize - Size of test data in bytes
   */
  async performBandwidthTest(testSize) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/bandwidth-test?size=${testSize}`, {
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error('Bandwidth test request failed');
      }
      
      // Read the entire response
      await response.arrayBuffer();
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const bandwidth = (testSize * 8) / duration; // bits per second
      
      return bandwidth;
      
    } catch (error) {
      console.warn('Bandwidth test failed:', error);
      return 0;
    }
  }

  /**
   * Add bandwidth sample to history
   * @param {number} bandwidth - Bandwidth in bps
   */
  addBandwidthSample(bandwidth) {
    this.bandwidthHistory.push({
      bandwidth,
      timestamp: Date.now()
    });

    // Keep only recent samples
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes
    this.bandwidthHistory = this.bandwidthHistory.filter(
      sample => sample.timestamp > cutoff
    );

    // Limit total samples
    if (this.bandwidthHistory.length > this.options.bandwidthSamples) {
      this.bandwidthHistory.shift();
    }
  }

  /**
   * Get average bandwidth from recent samples
   */
  getAverageBandwidth() {
    if (this.bandwidthHistory.length === 0) {
      return 2500000; // Default 2.5 Mbps
    }

    const total = this.bandwidthHistory.reduce((sum, sample) => sum + sample.bandwidth, 0);
    return total / this.bandwidthHistory.length;
  }

  /**
   * Select optimal quality based on bandwidth and device
   */
  selectOptimalQuality() {
    if (this.qualityLocked) {
      return this.currentQuality;
    }

    const avgBandwidth = this.getAverageBandwidth();
    const bufferLevel = this.getBufferLevel();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const screenWidth = screen.width * devicePixelRatio;

    // Consider buffer health
    let bandwidthMultiplier = 1.0;
    if (bufferLevel < 10) {
      bandwidthMultiplier = 0.7; // Be more conservative with low buffer
    } else if (bufferLevel > 30) {
      bandwidthMultiplier = 1.3; // Be more aggressive with high buffer
    }

    const effectiveBandwidth = avgBandwidth * bandwidthMultiplier;

    // Find best quality that fits bandwidth and screen
    for (let i = this.qualityLevels.length - 1; i >= 0; i--) {
      const quality = this.qualityLevels[i];
      
      // Check bandwidth requirement (with safety margin)
      if (effectiveBandwidth >= quality.bandwidth * 1.2) {
        // Check if screen resolution makes sense
        if (screenWidth >= quality.width || i === 0) {
          return quality.name;
        }
      }
    }

    return '360p'; // Fallback to lowest quality
  }

  /**
   * Get current buffer level in seconds
   */
  getBufferLevel() {
    if (!this.video.buffered.length) {
      return 0;
    }

    const currentTime = this.video.currentTime;
    for (let i = 0; i < this.video.buffered.length; i++) {
      if (currentTime >= this.video.buffered.start(i) && 
          currentTime <= this.video.buffered.end(i)) {
        return this.video.buffered.end(i) - currentTime;
      }
    }

    return 0;
  }

  /**
   * Setup video event listeners for adaptive streaming
   */
  setupEventListeners() {
    // Monitor stalls and buffer events
    this.video.addEventListener('waiting', () => {
      this.stallCount++;
      console.log('Video stalled, count:', this.stallCount);
      
      // If we're stalling frequently, reduce quality
      if (this.stallCount > 3) {
        this.requestQualityChange('down');
      }
    });

    this.video.addEventListener('canplay', () => {
      // Reset stall count when playback is smooth
      this.stallCount = Math.max(0, this.stallCount - 1);
    });

    // Monitor download progress for bandwidth estimation
    this.video.addEventListener('progress', () => {
      this.updateDownloadStats();
    });

    // Handle quality changes
    this.video.addEventListener('loadstart', () => {
      this.updateStreamingMetrics();
    });

    // Network change detection
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        this.handleNetworkChange();
      });
    }
  }

  /**
   * Start quality monitoring loop
   */
  startQualityMonitoring() {
    setInterval(() => {
      if (!this.isAdaptiveEnabled) return;

      this.updateBufferHealth();
      const optimalQuality = this.selectOptimalQuality();
      
      if (optimalQuality !== this.currentQuality) {
        this.requestQualityChange(optimalQuality);
      }
    }, this.options.qualityCheckInterval);
  }

  /**
   * Request quality change
   * @param {string|string} newQuality - Target quality or 'up'/'down'
   */
  requestQualityChange(newQuality) {
    if (this.qualityLocked) return;

    let targetQuality;
    
    if (newQuality === 'up') {
      const currentIndex = this.qualityLevels.findIndex(q => q.name === this.currentQuality);
      const nextIndex = Math.min(currentIndex + 1, this.qualityLevels.length - 1);
      targetQuality = this.qualityLevels[nextIndex].name;
    } else if (newQuality === 'down') {
      const currentIndex = this.qualityLevels.findIndex(q => q.name === this.currentQuality);
      const nextIndex = Math.max(currentIndex - 1, 0);
      targetQuality = this.qualityLevels[nextIndex].name;
    } else {
      targetQuality = newQuality;
    }

    if (targetQuality === this.currentQuality) return;

    console.log(`Quality change requested: ${this.currentQuality} -> ${targetQuality}`);
    this.switchQuality(targetQuality);
  }

  /**
   * Switch to new quality
   * @param {string} newQuality - Target quality
   */
  async switchQuality(newQuality) {
    if (!this.video.src) return;

    const currentTime = this.video.currentTime;
    const wasPlaying = !this.video.paused;
    
    try {
      // Get new stream URL with different quality
      const baseUrl = this.video.src.split('?')[0];
      const newUrl = baseUrl.replace(/\/[^\/]+\/playlist\.m3u8$/, `/${newQuality}/playlist.m3u8`);
      
      this.targetQuality = newQuality;
      
      // Switch source
      this.video.src = newUrl;
      this.video.currentTime = currentTime;
      
      if (wasPlaying) {
        await this.video.play();
      }
      
      this.currentQuality = newQuality;
      this.targetQuality = null;
      
      // Dispatch custom event
      this.video.dispatchEvent(new CustomEvent('qualitychange', {
        detail: { 
          oldQuality: this.currentQuality, 
          newQuality: newQuality,
          reason: 'adaptive'
        }
      }));
      
    } catch (error) {
      console.error('Quality switch failed:', error);
      this.targetQuality = null;
    }
  }

  /**
   * Update download statistics for bandwidth estimation
   */
  updateDownloadStats() {
    if (!this.video.buffered.length) return;

    const now = Date.now();
    const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
    const bufferedStart = this.video.buffered.start(0);
    const bufferedDuration = bufferedEnd - bufferedStart;
    
    // Estimate download speed based on buffer growth
    const lastStat = this.downloadStats.get('last');
    if (lastStat && bufferedDuration > lastStat.bufferedDuration) {
      const timeDiff = (now - lastStat.timestamp) / 1000;
      const bufferGrowth = bufferedDuration - lastStat.bufferedDuration;
      
      if (timeDiff > 0 && bufferGrowth > 0) {
        // Estimate bandwidth (very rough)
        const quality = this.qualityLevels.find(q => q.name === this.currentQuality);
        const estimatedBandwidth = (bufferGrowth * quality.bandwidth) / timeDiff;
        this.addBandwidthSample(estimatedBandwidth);
      }
    }
    
    this.downloadStats.set('last', {
      timestamp: now,
      bufferedDuration: bufferedDuration
    });
  }

  /**
   * Update buffer health metrics
   */
  updateBufferHealth() {
    const bufferLevel = this.getBufferLevel();
    this.bufferHealth.push({
      level: bufferLevel,
      timestamp: Date.now()
    });

    // Keep only recent samples
    if (this.bufferHealth.length > 20) {
      this.bufferHealth.shift();
    }
  }

  /**
   * Handle network connectivity changes
   */
  handleNetworkChange() {
    if (!('connection' in navigator)) return;

    const connection = navigator.connection;
    console.log('Network changed:', {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    });

    // Estimate bandwidth from connection info
    const connectionBandwidth = this.estimateBandwidthFromConnection(connection);
    if (connectionBandwidth > 0) {
      this.addBandwidthSample(connectionBandwidth);
    }

    // Immediate quality adjustment for significant changes
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      this.requestQualityChange('360p');
    }
  }

  /**
   * Estimate bandwidth from network connection info
   * @param {NetworkInformation} connection - Navigator connection object
   */
  estimateBandwidthFromConnection(connection) {
    const effectiveTypes = {
      'slow-2g': 0.05,   // 50 Kbps
      '2g': 0.25,        // 250 Kbps
      '3g': 1.5,         // 1.5 Mbps
      '4g': 10.0         // 10 Mbps
    };

    const baseSpeed = effectiveTypes[connection.effectiveType] || 2.5;
    
    // Use downlink if available (more accurate)
    if (connection.downlink) {
      return connection.downlink * 1000000; // Convert to bps
    }
    
    return baseSpeed * 1000000; // Convert to bps
  }

  /**
   * Update streaming metrics for analytics
   */
  updateStreamingMetrics() {
    const metrics = {
      currentQuality: this.currentQuality,
      averageBandwidth: this.getAverageBandwidth(),
      bufferLevel: this.getBufferLevel(),
      stallCount: this.stallCount,
      timestamp: Date.now()
    };

    // Send to analytics (non-blocking)
    this.sendMetrics(metrics).catch(console.warn);
  }

  /**
   * Send metrics to server
   * @param {Object} metrics - Streaming metrics
   */
  async sendMetrics(metrics) {
    try {
      await fetch('/api/streaming-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
    } catch (error) {
      // Ignore metrics errors
    }
  }

  /**
   * Manual quality selection
   * @param {string} quality - Target quality
   */
  setQuality(quality) {
    if (quality === 'auto') {
      this.qualityLocked = false;
      this.isAdaptiveEnabled = true;
      this.requestQualityChange(this.selectOptimalQuality());
    } else {
      this.qualityLocked = true;
      this.isAdaptiveEnabled = false;
      this.requestQualityChange(quality);
    }
  }

  /**
   * Get current streaming statistics
   */
  getStats() {
    return {
      currentQuality: this.currentQuality,
      targetQuality: this.targetQuality,
      averageBandwidth: Math.round(this.getAverageBandwidth()),
      bufferLevel: Math.round(this.getBufferLevel()),
      stallCount: this.stallCount,
      isAdaptive: this.isAdaptiveEnabled,
      qualityLocked: this.qualityLocked,
      bandwidthSamples: this.bandwidthHistory.length,
      availableQualities: this.qualityLevels.map(q => q.name)
    };
  }

  /**
   * Cleanup and destroy the adaptive streaming manager
   */
  destroy() {
    // Clear intervals and listeners
    if (this.qualityMonitorInterval) {
      clearInterval(this.qualityMonitorInterval);
    }

    // Remove event listeners
    this.video.removeEventListener('waiting', this.onWaiting);
    this.video.removeEventListener('canplay', this.onCanPlay);
    this.video.removeEventListener('progress', this.onProgress);

    if ('connection' in navigator) {
      navigator.connection.removeEventListener('change', this.onNetworkChange);
    }
  }
}

/**
 * Utility function to create adaptive streaming for a video element
 * @param {HTMLVideoElement} videoElement - Video element
 * @param {Object} options - Configuration options
 */
export function createAdaptiveStreaming(videoElement, options = {}) {
  return new AdaptiveStreamingManager(videoElement, options);
}