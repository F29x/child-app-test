import { useState, useEffect, useCallback } from 'react'

interface LogEntry {
  id: number
  type: 'sent' | 'received'
  message: string
  timestamp: Date
}

interface PatientData {
  id: string
  nome: string
  cognome: string
  codiceFiscale: string
  dataNascita: string
}

interface MessageData {
  type: string
  payload?: any
  timestamp?: number
}

function App() {
  // Detect if running inside iframe
  const [isInIframe] = useState(() => window.self !== window.top)
  const [isConnected, setIsConnected] = useState(false)
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [formData, setFormData] = useState({ diagnosis: '', notes: '' })

  const logIdRef = { current: 0 }

  // Add log entry
  const addLog = useCallback((type: 'sent' | 'received', message: string) => {
    setLogs(prev => [...prev.slice(-19), {
      id: logIdRef.current++,
      type,
      message,
      timestamp: new Date()
    }])
  }, [])

  // SEND message to parent
  const sendToParent = useCallback((data: MessageData) => {
    if (!isInIframe) {
      console.warn('Not in iframe, cannot send to parent')
      addLog('sent', `FAILED (not in iframe): ${data.type}`)
      return
    }

    const messageWithTimestamp = {
      ...data,
      timestamp: Date.now()
    }

    // Use '*' for cross-origin communication
    window.parent.postMessage(messageWithTimestamp, '*')
    console.log('📤 Child sent:', messageWithTimestamp)
    addLog('sent', `${data.type}: ${JSON.stringify(data.payload || {})}`)
  }, [isInIframe, addLog])

  // RECEIVE messages from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In production, validate origin:
      // if (event.origin !== 'https://your-parent-app.vercel.app') return

      const data = event.data as MessageData
      if (!data?.type) return

      console.log('📨 Child received:', data)
      addLog('received', `${data.type}: ${JSON.stringify(data.payload || {})}`)
      setLastMessage(data)

      switch (data.type) {
        case 'INIT_DATA':
          setIsConnected(true)
          break

        case 'PATIENT_DATA':
          setPatientData(data.payload)
          break

        case 'NAVIGATE_CHILD':
          alert(`Parent requested navigation to: ${data.payload?.route}`)
          break

        default:
          // Handle other messages
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [addLog])

  // Signal CHILD_READY to parent when mounted
  useEffect(() => {
    if (isInIframe) {
      // Small delay to ensure parent listener is ready
      const timer = setTimeout(() => {
        sendToParent({ type: 'CHILD_READY', payload: { version: 'React 19' } })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isInIframe, sendToParent])

  // Navigate parent back
  const navigateParentBack = () => {
    sendToParent({
      type: 'NAVIGATE_PARENT',
      payload: { url: '/clinic-parent/anagrafica' }
    })
  }

  // Send data back to parent
  const sendDataToParent = () => {
    sendToParent({
      type: 'DATA_FROM_CHILD',
      payload: {
        patientId: patientData?.id,
        diagnosis: formData.diagnosis,
        notes: formData.notes,
        savedAt: new Date().toISOString()
      }
    })
  }

  // Simulate save action
  const handleSaveAndReturn = () => {
    sendToParent({
      type: 'RICOVERO_SAVED',
      payload: {
        patientId: patientData?.id,
        ...formData
      }
    })
    // Then request parent to navigate
    setTimeout(() => {
      navigateParentBack()
    }, 500)
  }

  return (
    <div className="child-container">
      <div className="header">
        <h1>👶 Child App (Vite + React 19)</h1>
        <p>This simulates your new Ricoveri module</p>
        <span className={`mode-badge ${isInIframe ? 'iframe' : 'standalone'}`}>
          {isInIframe ? '📦 Running in Iframe' : '🖥️ Standalone Mode'}
        </span>
      </div>

      {/* Connection Status */}
      <div className="panel">
        <h2>📡 Connection Status</h2>
        <div className="status-row">
          <span className={`status-dot ${isInIframe ? 'green' : 'red'}`}></span>
          <span>In Iframe: {isInIframe ? 'Yes' : 'No'}</span>
        </div>
        <div className="status-row">
          <span className={`status-dot ${isConnected ? 'green' : 'red'}`}></span>
          <span>Connected to Parent: {isConnected ? 'Yes ✓' : 'Waiting...'}</span>
        </div>
      </div>

      {/* Received Patient Data */}
      {patientData && (
        <div className="panel">
          <h2>👤 Patient Data (from Parent)</h2>
          <div className="patient-card">
            <h3>{patientData.nome} {patientData.cognome}</h3>
            <p><strong>ID:</strong> {patientData.id}</p>
            <p><strong>CF:</strong> {patientData.codiceFiscale}</p>
            <p><strong>Born:</strong> {patientData.dataNascita}</p>
          </div>
        </div>
      )}

      {/* Form to simulate work */}
      <div className="panel">
        <h2>📝 Ricovero Form (simulated)</h2>
        <div className="form-group">
          <label>Diagnosis</label>
          <input
            type="text"
            value={formData.diagnosis}
            onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
            placeholder="Enter diagnosis..."
          />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <input
            type="text"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Enter notes..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="panel">
        <h2>🎮 Send to Parent</h2>
        <div className="button-group">
          <button className="btn btn-primary" onClick={sendDataToParent}>
            Send Form Data
          </button>
          <button className="btn btn-danger" onClick={navigateParentBack}>
            Navigate Parent Back
          </button>
          <button className="btn btn-success" onClick={handleSaveAndReturn}>
            Save & Return
          </button>
        </div>
      </div>

      {/* Message Log */}
      <div className="panel">
        <h2>📜 Message Log</h2>
        <div className="messages-log">
          {logs.length === 0 ? (
            <div style={{ color: '#888' }}>Waiting for messages...</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type}`}>
                [{log.timestamp.toLocaleTimeString()}] {log.type.toUpperCase()}: {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Debug: Last Received */}
      <div className="panel">
        <h2>🔍 Last Message Received</h2>
        <div className="data-display">
          {lastMessage ? JSON.stringify(lastMessage, null, 2) : 'No messages yet'}
        </div>
      </div>
    </div>
  )
}

export default App
