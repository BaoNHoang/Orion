import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { OrionIcon } from './components/OrionIcon'

const OrionResonanceCore = lazy(() => import('./components/OrionResonanceCore'))

type Message = {
  id: number
  role: 'user' | 'assistant'
  content: string
  time: string
}

type CouncilReport = {
  positions: Array<{ name: string; role: string; response: string }>
  conclusion: string
}

type CouncilRoute = { convene: boolean; automatic: boolean; reason: string; research?: boolean; researchQuery?: string }
type WebSource = { title: string; url: string; snippet: string; evidence?: string; published?: string | null; retrieved?: boolean }

type Memory = { id: number; category: string; value: string; sensitive: number; approved: number }
type Workspace = { id: number; name: string; color: string }
type Conversation = { id: number; title: string; workspace: string; message_count: number }
type ConversationSearchResult = { id: number; title: string; workspace: string; snippet: string }
type ConversationMode = 'text' | 'voice'

const API = 'http://127.0.0.1:8787/api'

const astriumMembers = [
  { name: 'Nebula', role: 'Strategist', tone: 'Long view', color: 'nebula' },
  { name: 'Helix', role: 'Skeptic', tone: 'Tests claims', color: 'helix' },
  { name: 'Nereid', role: 'Advocate', tone: 'Protects intent', color: 'nereid' },
  { name: 'Nova', role: 'Operator', tone: 'Makes it real', color: 'nova' },
]

function formatTime() {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [voiceActive, setVoiceActive] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [conversationMode, setConversationMode] = useState<ConversationMode>(() => localStorage.getItem('orion.conversationMode') === 'voice' ? 'voice' : 'text')
  const [councilOpen, setCouncilOpen] = useState(true)
  const [localReady, setLocalReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [councilRunning, setCouncilRunning] = useState(false)
  const [councilReport, setCouncilReport] = useState<CouncilReport | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [memorySensitive, setMemorySensitive] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceSuggestion, setWorkspaceSuggestion] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  const [sources, setSources] = useState<WebSource[]>([])
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [researchStatus, setResearchStatus] = useState<'idle' | 'searching' | 'online' | 'offline'>('idle')
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [activeWorkspace, setActiveWorkspace] = useState('Inbox')
  const [contextVisible, setContextVisible] = useState(() => window.innerWidth > 1100)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => localStorage.getItem('orion.voiceURI') ?? '')
  const [voiceRate, setVoiceRate] = useState(() => Number(localStorage.getItem('orion.voiceRate')) || 0.95)
  const [autoResearch, setAutoResearch] = useState(() => localStorage.getItem('orion.autoResearch') !== 'false')
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('orion.autoSpeak') !== 'false')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const voiceSubmitTimer = useRef<number | undefined>(undefined)
  const voiceModeRef = useRef(false)
  const voiceLevelRef = useRef(0)
  const voiceAudioContextRef = useRef<AudioContext | null>(null)
  const voiceAudioStreamRef = useRef<MediaStream | null>(null)
  const voiceMeterFrameRef = useRef<number | undefined>(undefined)
  const recognitionRef = useRef<any>(null)
  const thinkingRef = useRef(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const activeConversationRef = useRef(0)
  const creatingConversationRef = useRef(false)
  const startNewConversationRef = useRef<() => Promise<void>>(async () => undefined)
  startNewConversationRef.current = startNewConversation

  useEffect(() => {
    fetch(`${API}/conversations`)
      .then((response) => response.json())
      .then(async (payload) => {
        const available = payload.conversations ?? []
        setConversations(available)
        if (available[0]) await loadEarlierConversation(available[0].id)
        else await startNewConversationRef.current()
      })
      .catch(() => undefined)
    fetch(`${API}/ollama/status`)
      .then((response) => response.json())
      .then((status) => setLocalReady(Boolean(status.available)))
      .catch(() => setLocalReady(false))
    fetch(`${API}/memories`)
      .then((response) => response.json())
      .then((payload) => setMemories(payload.memories ?? []))
      .catch(() => undefined)
    fetch(`${API}/workspaces`)
      .then((response) => response.json())
      .then((payload) => setWorkspaces(payload.workspaces ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => () => stopVoiceMeter(), [])

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const refreshVoices = () => setAvailableVoices(window.speechSynthesis.getVoices().sort((left, right) => left.lang.localeCompare(right.lang) || left.name.localeCompare(right.name)))
    refreshVoices()
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices)
  }, [])

  const visibleConversations = useMemo(() => conversations.filter((conversation) => conversation.workspace === activeWorkspace), [activeWorkspace, conversations])

  async function refreshConversations() {
    const response = await fetch(`${API}/conversations`)
    if (!response.ok) return
    const payload = await response.json()
    setConversations(payload.conversations ?? [])
  }

  async function generateConversationTitle(message: string, conversationId: number) {
    const response = await fetch(`${API}/title`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId }) }).catch(() => null)
    if (!response?.ok) return
    const payload = await response.json()
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, title: payload.title } : conversation))
  }

  async function searchConversations(event: FormEvent) {
    event.preventDefault()
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) return
    const payload = await response.json()
    setSearchResults(payload.results ?? [])
  }

  async function openSearchResult(id: number) {
    await loadEarlierConversation(id)
    setSearchOpen(false)
  }

  function prepareWebResearch() {
    setDraft((current) => current.trim() ? current : 'Search the web for ')
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  function persistMessage(message: Message) {
    return fetch(`${API}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, conversationId: activeConversationRef.current }),
    }).catch(() => undefined)
  }

  async function submitMessage(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim()
    if (!content || thinking) return
    const conversationId = activeConversationRef.current
    const shouldGenerateTitle = conversations.some((conversation) => conversation.id === conversationId && conversation.title === 'New conversation')

    const userMessage: Message = { id: Date.now(), role: 'user', content, time: formatTime() }
    setMessages((current) => [...current, userMessage])
    if (/\b(plan|project|build|develop|design)\b/i.test(content) && !workspaces.some((workspace) => workspace.name === 'Planning')) setWorkspaceSuggestion('Planning')
    void persistMessage(userMessage)
    setDraft('')
    setThinking(true)
    thinkingRef.current = true
    recognitionRef.current?.stop()

    let councilRoute: CouncilRoute = {
      convene: /\b(astrium|council|advisers|advisors|nebula|helix|nereid|nova)\b/i.test(content),
      automatic: false,
      reason: 'The user explicitly requested Astrium.',
    }
    try {
      const routingContext = [...messages.slice(-4), userMessage].map((message) => `${message.role}: ${message.content}`).join('\n')
      const routeResponse = await fetch(`${API}/route`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content, context: routingContext }) })
      if (routeResponse.ok) councilRoute = await routeResponse.json()
    } catch {
      // Explicit Astrium requests still work if the lightweight router is unavailable.
    }

    let webSources: WebSource[] = []
    const explicitResearch = /\b(search|browse|look up|find online|verify online)\b/i.test(content)
    if (councilRoute.research && (autoResearch || explicitResearch)) {
      setResearchStatus('searching')
      try {
        const researchResponse = await fetch(`${API}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: councilRoute.researchQuery || content, conversationId: activeConversationRef.current }) })
        if (!researchResponse.ok) throw new Error('Research unavailable')
        const researchPayload = await researchResponse.json()
        webSources = researchPayload.sources ?? []
        setSources(webSources)
        setResearchStatus('online')
      } catch {
        setSources([])
        setResearchStatus('offline')
      }
    }

    if (councilRoute.convene) {
      setCouncilRunning(true)
      try {
        const topic = [...messages.slice(-4), userMessage].map((message) => `${message.role}: ${message.content}`).join('\n')
        const response = await fetch(`${API}/council`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, conversationId: activeConversationRef.current, research: webSources }) })
        if (!response.ok) {
          const failure = await response.json().catch(() => ({ error: 'Astrium returned an invalid response.' }))
          throw new Error(failure.error || 'Astrium is unavailable.')
        }
        const report: CouncilReport = await response.json()
        setCouncilReport(report)
        setCouncilOpen(true)
        const introduction = councilRoute.automatic ? `${councilRoute.reason} I convened Astrium.` : 'I have summoned Astrium at your request.'
        const assistantMessage: Message = { id: Date.now() + 1, role: 'assistant', content: `${introduction}\n\nAstrium decision: ${report.conclusion}`, time: formatTime() }
        setMessages((current) => [...current, assistantMessage])
        void persistMessage(assistantMessage)
        speak(assistantMessage.content)
        setLocalReady(true)
        void refreshConversations()
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'The cause was not reported.'
        const assistantMessage: Message = { id: Date.now() + 1, role: 'assistant', content: `Astrium could not complete its deliberation. ${detail}`, time: formatTime() }
        setMessages((current) => [...current, assistantMessage])
        void persistMessage(assistantMessage)
        speak(assistantMessage.content)
      } finally {
        setCouncilRunning(false)
        setThinking(false)
        if (!window.speechSynthesis.speaking) thinkingRef.current = false
        if (shouldGenerateTitle) void generateConversationTitle(content, conversationId)
      }
      return
    }

    try {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history: messages.slice(-8), research: webSources }),
      })
      if (!response.ok) throw new Error('Local model unavailable')
      const payload = await response.json()
      const assistantMessage: Message = {
        id: Date.now() + 1, role: 'assistant', content: payload.message, time: formatTime(),
      }
      setMessages((current) => [
        ...current,
        assistantMessage,
      ])
      speak(assistantMessage.content)
      void persistMessage(assistantMessage)
      void refreshConversations()
      setLocalReady(true)
    } catch {
      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content:
          'The local intelligence service is not online yet. The command centre remains private and functional; install Ollama, then start a local model to speak with me without an API bill.',
        time: formatTime(),
      }
      setMessages((current) => [
        ...current,
        assistantMessage,
      ])
      speak(assistantMessage.content)
      void persistMessage(assistantMessage)
      setLocalReady(false)
    } finally {
      setThinking(false)
      if (shouldGenerateTitle) void generateConversationTitle(content, conversationId)
      if (!window.speechSynthesis.speaking) {
        thinkingRef.current = false
        if (voiceModeRef.current) beginListening()
      }
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault()
    void submitMessage()
  }

  function speak(text: string, force = false) {
    if (!('speechSynthesis' in window)) return
    if (!force && !autoSpeak && !voiceModeRef.current) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const spokenText = text.replace(/```[\s\S]*?```/g, ' code omitted ').replace(/[*_#`~>|[\](){}]/g, ' ').replace(/\s+/g, ' ').trim()
    const utterance = new SpeechSynthesisUtterance(spokenText)
    const voices = window.speechSynthesis.getVoices()
    const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI)
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb'))
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.lang = selectedVoice?.lang || 'en-GB'
    utterance.rate = voiceRate
    setSpeaking(true)
    utterance.onend = () => {
      setSpeaking(false)
      thinkingRef.current = false
      if (voiceModeRef.current) beginListening()
    }
    utterance.onerror = () => {
      setSpeaking(false)
      thinkingRef.current = false
      if (voiceModeRef.current) beginListening()
    }
    window.speechSynthesis.speak(utterance)
  }

  function beginListening() {
    if (!voiceModeRef.current || thinkingRef.current || recognitionRef.current) return
    const Recognition = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition
    if (!Recognition) {
      setVoiceActive(false)
      voiceModeRef.current = false
      return
    }
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-GB'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((result: any) => result[0].transcript).join('')
      setDraft(transcript)
      if (composerRef.current) {
        composerRef.current.style.height = 'auto'
        composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, window.innerHeight / 3)}px`
      }
      if (voiceSubmitTimer.current) window.clearTimeout(voiceSubmitTimer.current)
      if (event.results[event.results.length - 1]?.isFinal) {
        voiceSubmitTimer.current = window.setTimeout(() => {
          voiceSubmitTimer.current = undefined
          recognition.stop()
          recognitionRef.current = null
          void submitMessage(transcript)
        }, 1800)
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      if (voiceModeRef.current && !thinkingRef.current && !voiceSubmitTimer.current) window.setTimeout(beginListening, 350)
    }
    recognition.onerror = () => {
      recognitionRef.current = null
      if (voiceModeRef.current && !thinkingRef.current) window.setTimeout(beginListening, 600)
    }
    recognition.start()
  }

  async function startVoiceMeter() {
    if (!navigator.mediaDevices?.getUserMedia || voiceAudioStreamRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true } })
      if (!voiceModeRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.76
      audioContext.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      voiceAudioContextRef.current = audioContext
      voiceAudioStreamRef.current = stream

      const measure = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) {
          const normalized = (sample - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / samples.length)
        const target = Math.min(rms * 5.8, 1)
        voiceLevelRef.current += (target - voiceLevelRef.current) * (target > voiceLevelRef.current ? 0.42 : 0.16)
        voiceMeterFrameRef.current = window.requestAnimationFrame(measure)
      }
      measure()
    } catch {
      voiceLevelRef.current = 0
    }
  }

  function stopVoiceMeter() {
    if (voiceMeterFrameRef.current) window.cancelAnimationFrame(voiceMeterFrameRef.current)
    voiceMeterFrameRef.current = undefined
    voiceAudioStreamRef.current?.getTracks().forEach((track) => track.stop())
    voiceAudioStreamRef.current = null
    void voiceAudioContextRef.current?.close()
    voiceAudioContextRef.current = null
    voiceLevelRef.current = 0
  }

  function toggleVoice() {
    if (voiceModeRef.current) {
      setVoiceActive(false)
      voiceModeRef.current = false
      if (voiceSubmitTimer.current) window.clearTimeout(voiceSubmitTimer.current)
      voiceSubmitTimer.current = undefined
      recognitionRef.current?.stop()
      recognitionRef.current = null
      window.speechSynthesis?.cancel()
      setSpeaking(false)
      stopVoiceMeter()
      return
    }
    setVoiceActive(true)
    voiceModeRef.current = true
    void startVoiceMeter()
    beginListening()
  }

  function selectConversationMode(mode: ConversationMode) {
    setConversationMode(mode)
    localStorage.setItem('orion.conversationMode', mode)
  }

  async function conveneCouncil() {
    if (councilRunning) return
    setCouncilRunning(true)
    setCouncilReport(null)
    try {
      const response = await fetch(`${API}/council`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: messages.slice(-6).map((message) => `${message.role}: ${message.content}`).join('\n'), conversationId: activeConversationRef.current, research: sources }),
      })
      if (!response.ok) throw new Error('Astrium unavailable')
      const report: CouncilReport = await response.json()
      setCouncilReport(report)
      setCouncilOpen(true)
      const assistantMessage: Message = { id: Date.now(), role: 'assistant', content: `Astrium decision: ${report.conclusion}`, time: formatTime() }
      setMessages((current) => [...current, assistantMessage])
      void persistMessage(assistantMessage)
      speak(assistantMessage.content)
      void refreshConversations()
      setLocalReady(true)
    } catch {
      setCouncilReport({ positions: [], conclusion: 'Astrium requires an active local Ollama model. No opinions were fabricated.' })
      setLocalReady(false)
    } finally {
      setCouncilRunning(false)
    }
  }

  async function saveMemory(event: FormEvent) {
    event.preventDefault()
    const value = memoryDraft.trim()
    if (!value) return
    const response = await fetch(`${API}/memories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: memorySensitive ? 'Sensitive personal detail' : 'Personal preference', value, sensitive: memorySensitive }),
    })
    const payload = await response.json()
    setMemories((current) => [payload.memory, ...current])
    setMemoryDraft('')
    setMemorySensitive(false)
  }

  async function deleteMemory(id: number) {
    if (!window.confirm('Remove this memory from Orion? This cannot be undone.')) return
    await fetch(`${API}/memories/${id}`, { method: 'DELETE' })
    setMemories((current) => current.filter((memory) => memory.id !== id))
  }

  async function approveWorkspace() {
    if (!workspaceSuggestion) return
    const response = await fetch(`${API}/workspaces`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: workspaceSuggestion, color: 'planning' }),
    })
    const payload = await response.json()
    setWorkspaces((current) => [...current, payload.workspace])
    await fetch(`${API}/conversations/${activeConversationRef.current}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: workspaceSuggestion }) })
    setActiveWorkspace(workspaceSuggestion)
    void refreshConversations()
    setWorkspaceSuggestion(null)
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault()
    const name = workspaceName.trim()
    if (!name) return
    const response = await fetch(`${API}/workspaces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color: 'planning' }) })
    if (!response.ok) return
    const payload = await response.json()
    setWorkspaces((current) => current.some((workspace) => workspace.id === payload.workspace.id) ? current : [...current, payload.workspace])
    setActiveWorkspace(payload.workspace.name)
    setWorkspaceName('')
    setWorkspaceOpen(false)
  }

  async function startNewConversation() {
    if (creatingConversationRef.current) return
    const activeConversation = conversations.find((conversation) => conversation.id === activeConversationRef.current)
    if (activeConversation?.title === 'New conversation' && !messages.some((message) => message.role === 'user')) {
      composerRef.current?.focus()
      return
    }
    creatingConversationRef.current = true
    setCreatingConversation(true)
    const greeting: Message = {
      id: Date.now(),
      role: 'assistant',
      content: 'Good evening. A fresh conversation is ready. How may I assist?',
      time: formatTime(),
    }
    try {
      const response = await fetch(`${API}/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New conversation' }) })
      if (!response.ok) return
      const payload = await response.json()
      setActiveConversationId(payload.conversation.id)
      activeConversationRef.current = payload.conversation.id
      if (payload.reused && payload.conversation.message_count > 0) {
        await loadEarlierConversation(payload.conversation.id)
        await refreshConversations()
      } else {
        setConversations((current) => [{ ...payload.conversation, message_count: 1 }, ...current.filter((conversation) => conversation.id !== payload.conversation.id)])
        setMessages([greeting])
        setCouncilReport(null)
        setSources([])
        setResearchStatus('idle')
        void fetch(`${API}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...greeting, conversationId: payload.conversation.id }) })
      }
      setDraft('')
      composerRef.current?.focus()
    } finally {
      creatingConversationRef.current = false
      setCreatingConversation(false)
    }
  }

  async function loadEarlierConversation(id = 1) {
    activeConversationRef.current = id
    const [messageResponse, councilResponse, researchResponse] = await Promise.all([
      fetch(`${API}/messages?conversationId=${id}`),
      fetch(`${API}/council?conversationId=${id}`),
      fetch(`${API}/research?conversationId=${id}`),
    ])
    const [messagePayload, councilPayload, researchPayload] = await Promise.all([messageResponse.json(), councilResponse.json(), researchResponse.json()])
    setMessages(messagePayload.messages ?? [])
    setCouncilReport(councilPayload.report ?? null)
    setSources(researchPayload.report?.sources ?? [])
    setResearchStatus(researchPayload.report?.sources?.length ? 'online' : 'idle')
    setActiveConversationId(id)
  }

  async function confirmDeleteConversation() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    const response = await fetch(`${API}/conversations/${id}`, { method: 'DELETE' })
    if (!response.ok) return
    const remaining = conversations.filter((conversation) => conversation.id !== id)
    setConversations(remaining)
    setPendingDelete(null)
    if (activeConversationId === id) {
      if (remaining[0]) await loadEarlierConversation(remaining[0].id)
      else await startNewConversation()
    }
  }

  const voicePhase = speaking ? 'speaking' : thinking || councilRunning ? 'thinking' : voiceActive ? 'listening' : 'idle'
  const resonancePhase = councilRunning ? 'council' : voicePhase
  const voiceStatus = {
    idle: { title: 'Voice session paused' },
    listening: { title: 'Listening' },
    thinking: { title: councilRunning ? 'Astrium is deliberating' : 'Considering your request' },
    speaking: { title: 'Orion is speaking' },
  }[voicePhase]

  return (
    <main className={`command-centre ${contextVisible ? '' : 'context-hidden'}`}>
      <aside className="rail" aria-label="Primary navigation">
        <div className="brand-mark" aria-label="Orion">
          <img src="/orion-logo.svg" alt="" />
        </div>
        <nav className="rail-nav">
          <button className="rail-button active" title="Command centre" onClick={() => { setSearchOpen(false); setNotificationsOpen(false); setSettingsOpen(false) }}><OrionIcon name="command" size={19} /></button>
          <button className="rail-button" title="Search conversations" onClick={() => setSearchOpen(true)}><OrionIcon name="search" size={19} /></button>
          <button className="rail-button" title="System status" onClick={() => setNotificationsOpen(true)}><OrionIcon name="bell" size={19} /></button>
        </nav>
        <button className="rail-button rail-bottom" title="Settings" onClick={() => setSettingsOpen(true)}><OrionIcon name="settings" size={19} /></button>
      </aside>

      <aside className="sidebar">
        <header className="sidebar-header">
          <div>
            <h1>Orion</h1>
          </div>
        </header>

        <button className="new-conversation" onClick={startNewConversation} disabled={creatingConversation}><OrionIcon name={creatingConversation ? 'council' : 'plus'} size={16} /> {creatingConversation ? 'Preparing conversation' : 'New conversation'}</button>

        <section className="workspace-section">
          <div className="section-label"><span>Workspaces</span><button title="Create workspace" onClick={() => setWorkspaceOpen(true)}><OrionIcon name="plus" size={15} /></button></div>
          <button className={`workspace ${activeWorkspace === 'Inbox' ? 'active' : ''}`} onClick={() => setActiveWorkspace('Inbox')}><span className="workspace-dot inbox" />Inbox <span className="count">{conversations.filter((conversation) => conversation.workspace === 'Inbox').length}</span></button>
          {workspaces.filter((workspace) => workspace.name !== 'Inbox').map((workspace) => <button className={`workspace ${activeWorkspace === workspace.name ? 'active' : ''}`} onClick={() => setActiveWorkspace(workspace.name)} key={workspace.id}><span className={`workspace-dot ${workspace.color}`} />{workspace.name}</button>)}
        </section>

        <section className="workspace-section recent-section">
          <div className="section-label"><span>Recent</span></div>
          {visibleConversations.slice(0, 20).map((conversation) => <div className={`recent-row ${conversation.id === activeConversationId ? 'active-chat' : ''}`} key={conversation.id}><button className="recent-chat" onClick={() => loadEarlierConversation(conversation.id)}>{conversation.title}<span>{conversation.message_count} messages</span></button><button className="delete-chat" title="Delete chat" onClick={() => setPendingDelete(conversation)}><OrionIcon name="trash" size={13} /></button></div>)}
          {visibleConversations.length === 0 && <p className="empty-workspace">No conversations in this workspace.</p>}
        </section>

        <footer className="local-status">
          <span className={`status-light ${localReady ? 'ready' : ''}`} />
          <span>{localReady ? 'Local model connected' : 'Local model offline'}</span>
          <img className="status-asset" src="/assets/memory-vault.svg" alt="" />
        </footer>
      </aside>

      <section className="conversation" aria-label="Conversation with Orion">
        <header className="conversation-header">
          <div className="conversation-title">
            <div className="orion-avatar"><img src="/assets/orion-sigil.svg" alt="" /></div>
            <div><h2>Orion</h2><p>{localReady ? 'Local intelligence ready' : 'Private local session'}</p></div>
          </div>
          <div className="header-actions">
            <div className="conversation-modes" role="group" aria-label="Conversation view">
              <button type="button" className={conversationMode === 'text' ? 'active' : ''} aria-pressed={conversationMode === 'text'} onClick={() => selectConversationMode('text')}>Text</button>
              <button type="button" className={conversationMode === 'voice' ? 'active' : ''} aria-pressed={conversationMode === 'voice'} onClick={() => selectConversationMode('voice')}>Voice</button>
            </div>
            <button className="quiet-button" onClick={prepareWebResearch}><OrionIcon name="compass" size={16} /> Browse</button>
            <button className="icon-button" title={contextVisible ? 'Hide context' : 'Show context'} onClick={() => setContextVisible((visible) => !visible)}><OrionIcon name="panel" size={18} /></button>
          </div>
        </header>

        {conversationMode === 'text' ? <><div className="message-list" ref={messageListRef}>
          <div className="date-rule"><span>Today</span></div>
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              {message.role === 'assistant' && <div className="message-avatar"><img src="/assets/orion-sigil.svg" alt="" /></div>}
              <div className="message-content">
                <div className="message-meta"><strong>{message.role === 'assistant' ? 'Orion' : 'You'}</strong><time>{message.time}</time></div>
                <p>{message.content}</p>
              </div>
            </article>
          ))}
          {thinking && <article className="message assistant"><div className="message-avatar"><img src="/assets/orion-sigil.svg" alt="" /></div><div className="typing"><i /><i /><i /></div></article>}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <div className="composer-main">
            <textarea ref={composerRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, window.innerHeight / 3)}px` }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage() } }} placeholder="Speak plainly. Orion will consider it." rows={1} />
            <button type="button" className={`voice-button ${voiceActive ? 'listening' : ''}`} onClick={toggleVoice} title={voiceActive ? 'End voice session' : 'Start voice dictation'}>
              <OrionIcon name={voiceActive ? 'mic-off' : 'mic'} size={18} />
            </button>
            <button type="submit" className="send-button" aria-label="Send message"><OrionIcon name="chevron" size={18} /></button>
          </div>
          <p>{voiceActive ? 'Voice session active. Audio is never retained.' : 'Private by default. Personal memories require consent.'}</p>
        </form></> : <section className={`voice-stage ${voicePhase}`} aria-label={`Orion voice mode. ${voiceStatus.title}`}>
          <div className="resonance-shell">
            <Suspense fallback={<div className="resonance-loading" aria-hidden="true" />}>
              <OrionResonanceCore phase={resonancePhase} audioLevelRef={voiceLevelRef} />
            </Suspense>
            <button type="button" className="resonance-control" onClick={toggleVoice} aria-label={voiceActive ? 'End voice session' : 'Begin voice session'} title={voiceActive ? 'End voice session' : 'Begin voice session'} />
          </div>
          <div className="voice-state-copy" aria-live="polite">
            <h3>{voiceStatus.title}</h3>
          </div>
        </section>}
      </section>

      <aside className={`context-panel ${contextVisible ? 'context-visible' : ''}`}>
        <header className="context-header"><div><h2>Considerations</h2></div><button className="icon-button" title="Close context" onClick={() => setContextVisible(false)}><OrionIcon name="x" size={17} /></button></header>

        {workspaceSuggestion && <section className="context-card workspace-proposal"><div className="card-heading"><span>Workspace proposal</span><OrionIcon name="spark" size={16} /></div><p>Orion sees a sustained planning thread. Create <strong>{workspaceSuggestion}</strong> for this context?</p><div><button onClick={approveWorkspace}>Create workspace</button><button onClick={() => setWorkspaceSuggestion(null)}>Dismiss</button></div></section>}

        <section className="context-card memory-card">
          <div className="card-heading"><span>Memory in use</span><img className="card-asset" src="/assets/memory-vault.svg" alt="" /></div>
          <p className="memory-title">Operating principle</p>
          <p>Local first. Explicit consent for sensitive details and consequential actions.</p>
          <button className="text-button" onClick={() => setMemoryOpen(true)}>Review saved memories</button>
        </section>

        <section className="council-section">
          <button className="council-toggle" onClick={() => setCouncilOpen((open) => !open)}><span><OrionIcon name="council" size={16} /> Astrium</span><OrionIcon name="chevron" className={councilOpen ? 'up' : ''} size={17} /></button>
          {councilOpen && <div className="council-list">
            {astriumMembers.map((member) => <div className="council-member" key={member.name}><span className={`council-orb ${member.color}`} /><div><strong>{member.name}</strong><span>{member.role} - {member.tone}</span></div><span className="standing">Standing by</span></div>)}
            <button className="convene-button" onClick={conveneCouncil} disabled={councilRunning}>{councilRunning ? 'Astrium deliberating...' : 'Convene Astrium'}</button>
            {councilReport && <div className="council-report">
              {councilReport.positions.map((position) => <div className="council-position" key={position.name}><strong>{position.name}</strong><p>{position.response}</p></div>)}
              <div className="council-conclusion"><span>Orion's conclusion</span><p>{councilReport.conclusion}</p></div>
            </div>}
          </div>}
        </section>

        <section className="context-card source-card">
          <button className="source-toggle" onClick={() => setSourcesOpen((open) => !open)} aria-expanded={sourcesOpen}>
            <span><OrionIcon name="search" size={15} /> Sources</span>
            <span className="source-toggle-status">{researchStatus === 'searching' ? 'Searching' : sources.length ? `${sources.length} sources` : researchStatus === 'offline' ? 'Offline' : 'None'} <OrionIcon name="chevron" className={sourcesOpen ? 'up' : ''} size={15} /></span>
          </button>
          {sourcesOpen && <div className="source-content">
            {researchStatus === 'searching' && <p>Searching the web for current evidence...</p>}
            {researchStatus === 'offline' && <p>Internet research is unavailable. Orion will identify current claims as unverified.</p>}
            {researchStatus === 'idle' && !sources.length && <p>No web research was needed for this conversation.</p>}
            {sources.length > 0 && <div className="source-list">{sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><strong>{source.title}</strong><span>{new URL(source.url).hostname.replace(/^www\./, '')}</span><span className="source-status">{source.retrieved ? 'Page reviewed' : 'Search summary'}</span><p>{source.evidence || source.snippet}</p></a>)}</div>}
          </div>}
        </section>
      </aside>
      {memoryOpen && <div className="modal-backdrop" role="presentation">
        <section className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-title">
          <header><div><p className="eyebrow">Orion's ledger</p><h2 id="memory-title">Saved memories</h2></div><button className="icon-button" onClick={() => setMemoryOpen(false)} title="Close memories"><OrionIcon name="x" size={18} /></button></header>
          <p className="modal-intro">Only details you explicitly save appear here. Sensitive details are marked and never inferred into memory automatically.</p>
          <form className="memory-form" onSubmit={saveMemory}>
            <textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Add a preference, goal, or detail Orion should retain" rows={3} />
            <label><input type="checkbox" checked={memorySensitive} onChange={(event) => setMemorySensitive(event.target.checked)} /> Mark as sensitive</label>
            <button type="submit">Save memory</button>
          </form>
          <div className="memory-list">
            {memories.length === 0 ? <p className="empty-memory">No memories saved yet.</p> : memories.map((memory) => <article key={memory.id}><div><span>{memory.sensitive ? 'Sensitive' : memory.category}</span><p>{memory.value}</p></div><button onClick={() => deleteMemory(memory.id)} title="Forget this memory"><OrionIcon name="trash" size={15} /></button></article>)}
          </div>
        </section>
      </div>}
      {settingsOpen && <div className="modal-backdrop" role="presentation">
        <section className="memory-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header><div><p className="eyebrow">Command configuration</p><h2 id="settings-title">Settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} title="Close settings"><OrionIcon name="x" size={18} /></button></header>
          <section className="settings-section"><h3>Research</h3><label className="setting-toggle"><span><strong>Automatic web research</strong><small>Use live sources for current and time-sensitive requests.</small></span><input type="checkbox" checked={autoResearch} onChange={(event) => { setAutoResearch(event.target.checked); localStorage.setItem('orion.autoResearch', String(event.target.checked)) }} /></label></section>
          <section className="settings-section voice-settings"><h3>Voice</h3><label className="setting-toggle"><span><strong>Speak responses</strong><small>Voice sessions always speak; this controls typed conversations.</small></span><input type="checkbox" checked={autoSpeak} onChange={(event) => { setAutoSpeak(event.target.checked); localStorage.setItem('orion.autoSpeak', String(event.target.checked)) }} /></label><label><span>Installed voice</span><select value={selectedVoiceURI} onChange={(event) => { setSelectedVoiceURI(event.target.value); localStorage.setItem('orion.voiceURI', event.target.value) }}><option value="">Automatic British voice</option>{availableVoices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}</select></label><label><span>Speaking rate</span><output>{voiceRate.toFixed(2)}</output><input type="range" min="0.65" max="1.25" step="0.05" value={voiceRate} onChange={(event) => { const rate = Number(event.target.value); setVoiceRate(rate); localStorage.setItem('orion.voiceRate', String(rate)) }} /></label><button type="button" className="voice-preview" onClick={() => speak('Good evening. Orion is ready to assist.', true)}>Preview voice</button></section>
        </section>
      </div>}
      {searchOpen && <div className="modal-backdrop" role="presentation">
        <section className="memory-modal utility-modal" role="dialog" aria-modal="true" aria-labelledby="search-title">
          <header><div><p className="eyebrow">Conversation archive</p><h2 id="search-title">Search chats</h2></div><button className="icon-button" onClick={() => setSearchOpen(false)} title="Close search"><OrionIcon name="x" size={18} /></button></header>
          <form className="utility-form" onSubmit={searchConversations}><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search titles and messages" /><button type="submit"><OrionIcon name="search" size={15} /> Search</button></form>
          <div className="search-results">{searchResults.map((result) => <button key={result.id} onClick={() => { setActiveWorkspace(result.workspace); void openSearchResult(result.id) }}><strong>{result.title}</strong><span>{result.workspace}</span><p>{result.snippet || 'Title match'}</p></button>)}{searchQuery.length >= 2 && searchResults.length === 0 && <p className="empty-memory">No matching conversations.</p>}</div>
        </section>
      </div>}
      {notificationsOpen && <div className="modal-backdrop" role="presentation">
        <section className="memory-modal utility-modal" role="dialog" aria-modal="true" aria-labelledby="status-title">
          <header><div><p className="eyebrow">Local diagnostics</p><h2 id="status-title">System status</h2></div><button className="icon-button" onClick={() => setNotificationsOpen(false)} title="Close status"><OrionIcon name="x" size={18} /></button></header>
          <div className="status-list"><div><span className={`status-light ${localReady ? 'ready' : ''}`} /><p><strong>Local model</strong><small>{localReady ? 'qwen3:4b is connected' : 'Ollama is unavailable'}</small></p></div><div><span className={`status-light ${researchStatus === 'online' ? 'ready' : ''}`} /><p><strong>Web research</strong><small>{researchStatus === 'online' ? `${sources.length} sources available in this chat` : researchStatus === 'offline' ? 'Last research attempt failed' : 'Available when a request requires it'}</small></p></div><div><span className={`status-light ${voiceActive ? 'ready' : ''}`} /><p><strong>Voice session</strong><small>{voiceActive ? 'Microphone session is active' : 'Microphone session is off'}</small></p></div></div>
        </section>
      </div>}
      {workspaceOpen && <div className="modal-backdrop" role="presentation">
        <section className="delete-modal workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-title"><header><div><p className="eyebrow">Context organisation</p><h2 id="workspace-title">Create workspace</h2></div><button className="icon-button" onClick={() => setWorkspaceOpen(false)} title="Close workspace"><OrionIcon name="x" size={18} /></button></header><form className="utility-form" onSubmit={createWorkspace}><input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Workspace name" maxLength={40} /><button type="submit">Create</button></form></section>
      </div>}
      {pendingDelete && <div className="modal-backdrop" role="presentation">
        <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <h2 id="delete-title">Delete this conversation?</h2>
          <p><strong>{pendingDelete.title}</strong> and all of its messages will be permanently removed from this computer.</p>
          <div><button onClick={() => setPendingDelete(null)}>Cancel</button><button onClick={confirmDeleteConversation}>Delete conversation</button></div>
        </section>
      </div>}
    </main>
  )
}

export default App
