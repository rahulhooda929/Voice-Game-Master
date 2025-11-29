import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audio-utils';
import { Message } from '../types';

interface UseGeminiLiveProps {
  systemInstruction: string;
  voiceName: string;
}

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [volume, setVolume] = useState(0); // For visualizer
  const [error, setError] = useState<string | null>(null);

  // Refs for audio context and state to avoid closure staleness
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Transcription state refs
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');

  const disconnect = useCallback(() => {
    // 1. Close audio contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // 2. Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // 3. Disconnect ScriptProcessor (deprecated but standard for raw audio access in web)
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    // 4. Stop all playing sources
    if (sourcesRef.current) {
        for (const source of sourcesRef.current) {
            try { source.stop(); } catch (e) { /* ignore */ }
        }
        sourcesRef.current.clear();
    }

    // 5. Close session if possible (method depends on SDK, typically close() or just letting it drop)
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            if (session && typeof session.close === 'function') {
                session.close();
            }
        }).catch(() => {});
        sessionPromiseRef.current = null;
    }

    setIsConnected(false);
    setVolume(0);
    // Reset transcription refs
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
  }, []);

  const connect = useCallback(async ({ systemInstruction, voiceName }: UseGeminiLiveProps) => {
    // Ensure previous session is cleaned up
    disconnect();

    try {
      setError(null);
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: systemInstruction,
          inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
          outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setIsConnected(true);

            // Setup Input Stream
            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(1, rms * 5)); // Amplify a bit for visualizer

              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                ctx,
                24000,
                1
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Transcriptions
            if (message.serverContent?.outputTranscription?.text) {
               currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
               setMessages(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.role === 'model' && last.isPartial) {
                       return [...prev.slice(0, -1), { ...last, text: currentOutputTranscriptionRef.current }];
                   } else {
                       return [...prev, { id: Date.now().toString(), role: 'model', text: currentOutputTranscriptionRef.current, timestamp: new Date(), isPartial: true }];
                   }
               });
            }
            
            if (message.serverContent?.inputTranscription?.text) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'user' && last.isPartial) {
                        return [...prev.slice(0, -1), { ...last, text: currentInputTranscriptionRef.current }];
                    } else {
                        return [...prev, { id: Date.now().toString(), role: 'user', text: currentInputTranscriptionRef.current, timestamp: new Date(), isPartial: true }];
                    }
                });
            }

            // Handle Turn Complete
            if (message.serverContent?.turnComplete) {
                // Finalize messages by removing partial flag
                setMessages(prev => prev.map(m => ({ ...m, isPartial: false })));
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }

            // Handle Interrupted
            if (message.serverContent?.interrupted) {
                // Stop all playing audio
                for (const source of sourcesRef.current) {
                    try { source.stop(); } catch(e) {}
                }
                sourcesRef.current.clear();
                // Reset time to current context time to avoid large gaps or overlaps
                if (outputAudioContextRef.current) {
                     nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
                }
                // Mark current message as final (or maybe interrupted?)
                setMessages(prev => prev.map(m => ({ ...m, isPartial: false })));
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }
          },
          onerror: (e: any) => {
            console.error('Session error:', e);
            setError(e.message || "An error occurred");
            setIsConnected(false);
          },
          onclose: (e: any) => {
            console.log('Session closed', e);
            setIsConnected(false);
          },
        },
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect');
      setIsConnected(false);
    }
  }, [disconnect]);

  useEffect(() => {
    return () => {
        disconnect();
    }
  }, [disconnect]);

  return { connect, disconnect, messages, isConnected, volume, error };
};
