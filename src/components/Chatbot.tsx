import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Camera } from 'lucide-react';
import { User } from '../types';
import Markdown from 'react-markdown';
import * as htmlToImage from 'html-to-image';
import { authFetch } from '../lib/firebase';

interface Message {
  role: 'user' | 'model';
  parts: any[];
}

export function Chatbot({ currentUser, currentView }: { currentUser: User | null, currentView: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', parts: [{ text: 'Hello! I am your Community Hero AI assistant. How can I help you today?' }] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingScreenshotPayload, setPendingScreenshotPayload] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatbotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset session when user changes (logs in/out)
    setMessages([
      { role: 'model', parts: [{ text: 'Hello! I am your Community Hero AI assistant. How can I help you today?' }] }
    ]);
    setPendingScreenshotPayload(null);
    setIsOpen(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pendingScreenshotPayload]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatbotRef.current && !chatbotRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // If there was a pending screenshot request, cancel it since user is asking a new question
    setPendingScreenshotPayload(null);

    const userMessage: Message = {
      role: 'user',
      parts: [{ text: input.trim() }]
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Keep last 10 messages for context, starting from a user message
      let startIndex = Math.max(0, newMessages.length - 10);
      while (startIndex < newMessages.length && newMessages[startIndex].role !== 'user') {
        startIndex++;
      }
      const messagesToSend = newMessages.slice(startIndex);

      const payload = {
        messages: messagesToSend.map(m => ({ role: m.role, parts: m.parts })),
        context: {
          role: currentUser?.role || 'Guest',
          currentView
        }
      };

      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${text}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Received invalid JSON from server. The server might not be running correctly.');
      }

      // If the model asks for a screenshot, require explicit user consent
      if (data.action === 'REQUEST_SCREENSHOT') {
        setPendingScreenshotPayload(payload);
        setIsLoading(false);
        return;
      }

      setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const isUnavailable = error?.message?.includes('503') || error?.message?.includes('unavailable');
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: isUnavailable ? 'The AI service is temporarily unavailable. Please try again later.' : 'Sorry, I encountered an error. Please try again.' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmScreenshot = async () => {
    if (!pendingScreenshotPayload) return;
    const payload = pendingScreenshotPayload;
    setPendingScreenshotPayload(null);
    setIsLoading(true);

    let screenshotData = '';
    try {
      screenshotData = await htmlToImage.toJpeg(document.body, {
        quality: 0.3,
        pixelRatio: 0.5,
        fontEmbedCSS: '',
        filter: (node) => {
          if (node.classList && node.classList.contains('chatbot-container')) {
            return false;
          }
          return true;
        }
      });
    } catch (err) {
      console.warn('Failed to capture screenshot', err);
    }

    try {
      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...payload,
          screenshot: screenshotData
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send message with screenshot: ${response.status} ${text}`);
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
    } catch (error: any) {
      console.error('Chat error with screenshot:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Failed to process the screen view. Please try again.' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineScreenshot = async () => {
    if (!pendingScreenshotPayload) return;
    const payload = pendingScreenshotPayload;
    setPendingScreenshotPayload(null);
    setIsLoading(true);

    try {
      const updatedMessages = [
        ...payload.messages,
        {
          role: 'user',
          parts: [{ text: 'Visual context was declined. Answer based on text context alone without requesting a screenshot.' }]
        }
      ];

      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...payload,
          messages: updatedMessages,
          screenshot: undefined
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send follow-up: ${response.status} ${text}`);
      }

      const data = await response.json();
      const answer = data.text 
        ? `Since visual context was declined, I'm now answering based on text context alone.\n\n${data.text}`
        : "Since visual context was declined, I'm now answering based on text context alone.";
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: answer }] }]);
    } catch (error: any) {
      console.error('Chat error after declining screenshot:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Since visual context was declined, I'm now answering based on text context alone." }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans chatbot-container" ref={chatbotRef}>
      {isOpen ? (
        <div className="bg-white border-2 border-black w-80 sm:w-96 h-[500px] max-h-[80vh] flex flex-col shadow-2xl flex-shrink-0 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="p-4 border-b-2 border-black bg-black text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">AI Agent</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-300 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 text-sm ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white border border-black text-black'}`}>
                  {msg.role === 'user' ? (
                    msg.parts[0].text
                  ) : (
                    <div className="markdown-body">
                      <Markdown>{msg.parts[0].text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingScreenshotPayload && (
              <div className="p-3 border-2 border-black bg-white shadow-sm flex flex-col gap-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black">
                  <Camera size={14} /> Screen View Request
                </div>
                <p className="text-xs text-gray-700">
                  The assistant is requesting to view your screen to help answer your question. Do you want to share a screenshot?
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleConfirmScreenshot}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50"
                  >
                    Allow Screen View
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineScreenshot}
                    disabled={isLoading}
                    className="px-3 py-1.5 border border-black bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 text-sm bg-white border border-black text-black flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSend} className="p-3 border-t-2 border-black bg-white flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 p-2 text-sm border border-black focus:outline-none focus:ring-1 focus:ring-black"
              disabled={isLoading || Boolean(pendingScreenshotPayload)}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim() || Boolean(pendingScreenshotPayload)}
              className="p-2 bg-black text-white disabled:bg-gray-400 hover:bg-gray-800 transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-[#232323] text-white border-2 border-black [border-style:groove] rounded-[30px] shadow-lg flex items-center justify-center hover:bg-gray-800 hover:-translate-y-1 transition-all group animate-in slide-in-from-bottom-10 fade-in duration-300"
        >
          <MessageSquare size={24} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}
