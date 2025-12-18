/**
 * API Service for Construction Site Voice Agent
 * Handles all worker and manager API calls
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ConstructionApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // ============================================
  // WORKER ENDPOINTS
  // ============================================

  async registerWorker(workerData) {
    const response = await fetch(`${this.baseUrl}/api/worker/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workerData),
    });

    if (!response.ok) {
      throw new Error(`Failed to register worker: ${response.statusText}`);
    }

    return response.json();
  }

  async getWorker(workerId) {
    const response = await fetch(`${this.baseUrl}/api/worker/${workerId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get worker: ${response.statusText}`);
    }

    return response.json();
  }

  async getWorkerByEmployeeId(employeeId) {
    const response = await fetch(`${this.baseUrl}/api/worker/employee/${employeeId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get worker: ${response.statusText}`);
    }

    return response.json();
  }

  async submitDailyUpdate(workerId, audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'update.webm');

    const response = await fetch(`${this.baseUrl}/api/worker/${workerId}/update`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to submit update: ${response.statusText}`);
    }

    return response.json();
  }

  async getWorkerUpdates(workerId, days = 30) {
    const response = await fetch(
      `${this.baseUrl}/api/worker/${workerId}/updates?days=${days}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get updates: ${response.statusText}`);
    }

    return response.json();
  }

  async getAllWorkers(siteLocation = null) {
    let url = `${this.baseUrl}/api/worker/`;
    if (siteLocation) {
      url += `?site_location=${encodeURIComponent(siteLocation)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get workers: ${response.statusText}`);
    }

    return response.json();
  }

  async getSites() {
    const response = await fetch(`${this.baseUrl}/api/worker/sites/list`);

    if (!response.ok) {
      throw new Error(`Failed to get sites: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================
  // MANAGER ENDPOINTS
  // ============================================

  async registerManager(managerData) {
    const response = await fetch(`${this.baseUrl}/api/manager/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(managerData),
    });

    if (!response.ok) {
      throw new Error(`Failed to register manager: ${response.statusText}`);
    }

    return response.json();
  }

  async getManager(managerId) {
    const response = await fetch(`${this.baseUrl}/api/manager/${managerId}`);

    if (!response.ok) {
      throw new Error(`Failed to get manager: ${response.statusText}`);
    }

    return response.json();
  }

  async getTodayUpdates(siteLocation = null) {
    let url = `${this.baseUrl}/api/manager/updates/today`;
    if (siteLocation) {
      url += `?site_location=${encodeURIComponent(siteLocation)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get today updates: ${response.statusText}`);
    }

    return response.json();
  }

  async getUpdatesByDate(date, siteLocation = null) {
    let url = `${this.baseUrl}/api/manager/updates/by-date?target_date=${date}`;
    if (siteLocation) {
      url += `&site_location=${encodeURIComponent(siteLocation)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get updates: ${response.statusText}`);
    }

    return response.json();
  }

  async getAggregatedSummary(date = null, siteLocation = null) {
    let url = `${this.baseUrl}/api/manager/updates/summary`;
    const params = [];
    if (date) params.push(`target_date=${date}`);
    if (siteLocation) params.push(`site_location=${encodeURIComponent(siteLocation)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get summary: ${response.statusText}`);
    }

    return response.json();
  }

  async getUpdateAudio(updateId, contentType = 'summary') {
    const response = await fetch(
      `${this.baseUrl}/api/manager/updates/${updateId}/audio?content_type=${contentType}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get audio: ${response.statusText}`);
    }

    return response.json();
  }

  async querySingleWorker(managerId, workerId, question, daysBack = 7) {
    const response = await fetch(
      `${this.baseUrl}/api/manager/query/single?manager_id=${managerId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          worker_id: workerId,
          days_back: daysBack,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query: ${response.statusText}`);
    }

    return response.json();
  }

  async queryMultipleWorkers(managerId, workerIds, question, daysBack = 7) {
    const response = await fetch(
      `${this.baseUrl}/api/manager/query/multiple?manager_id=${managerId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          worker_ids: workerIds,
          days_back: daysBack,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query: ${response.statusText}`);
    }

    return response.json();
  }

  async queryWithVoice(managerId, audioBlob, workerId = null, workerIds = null, daysBack = 7) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'question.webm');

    let url = `${this.baseUrl}/api/manager/query/voice?manager_id=${managerId}&days_back=${daysBack}`;
    if (workerId) url += `&worker_id=${workerId}`;
    if (workerIds && workerIds.length > 0) url += `&worker_ids=${workerIds.join(',')}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to query: ${response.statusText}`);
    }

    return response.json();
  }

  async getSiteSummary(siteLocation, date = null) {
    let url = `${this.baseUrl}/api/manager/site/summary/${encodeURIComponent(siteLocation)}`;
    if (date) url += `?target_date=${date}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get site summary: ${response.statusText}`);
    }

    return response.json();
  }

  async getQueryHistory(managerId, limit = 20) {
    const response = await fetch(
      `${this.baseUrl}/api/manager/query/history/${managerId}?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    return response.json();
  }

  async getManagerWorkersList(siteLocation = null) {
    let url = `${this.baseUrl}/api/manager/workers/list`;
    if (siteLocation) {
      url += `?site_location=${encodeURIComponent(siteLocation)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get workers: ${response.statusText}`);
    }

    return response.json();
  }

  async getAllManagers() {
    const response = await fetch(`${this.baseUrl}/api/manager/managers/list`);

    if (!response.ok) {
      throw new Error(`Failed to get managers: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  playAudioFromBase64(base64Audio) {
    if (!base64Audio) return null;

    try {
      const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      
      // Detect audio type from magic bytes
      let mimeType = 'audio/wav';
      if (audioBytes.length > 4) {
        // Check for WAV (RIFF header)
        if (audioBytes[0] === 0x52 && audioBytes[1] === 0x49 && 
            audioBytes[2] === 0x46 && audioBytes[3] === 0x46) {
          mimeType = 'audio/wav';
        }
        // Check for MP3 (ID3 or sync bytes)
        else if ((audioBytes[0] === 0x49 && audioBytes[1] === 0x44 && audioBytes[2] === 0x33) ||
                 (audioBytes[0] === 0xFF && (audioBytes[1] & 0xE0) === 0xE0)) {
          mimeType = 'audio/mpeg';
        }
      }
      
      const audioBlob = new Blob([audioBytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
      });
      
      return audio;
    } catch (err) {
      console.error('Error decoding audio:', err);
      return null;
    }
  }
}

export default ConstructionApiService;

