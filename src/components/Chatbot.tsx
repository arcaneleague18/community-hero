import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { User } from '../types';
import Markdown from 'react-markdown';
import * as htmlToImage from 'html-to-image';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatbotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset session when user changes (logs in/out)
    setMessages([
      { role: 'model', parts: [{ text: 'Hello! I am your Community Hero AI assistant. How can I help you today?' }] }
    ]);
    setIsOpen(false);
  }, [currentUser?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    const newMessages = [...messages, { role: 'user' as const, parts: [{ text: currentInput }] }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // To use less tokens, limit the history sent to the server.
      // We take a maximum of 5 messages. Since the last message is from the user,
      // an odd number ensures the sliced array starts with a user message,
      // which is required by the Gemini API after the server's initial model response.
      const historyLength = 5;
      let startIndex = newMessages.length - historyLength;
      if (startIndex < 1) startIndex = 1; // Always skip the first 'model' greeting message
      
      const messagesToSend = newMessages.slice(startIndex);

      const payload = {
        messages: messagesToSend.map(m => ({ role: m.role, parts: m.parts })),
        context: {
          role: currentUser?.role || 'Guest',
          currentView
        }
      };

      let response = await fetch('/api/chat', {
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

      if (data.action === 'REQUEST_SCREENSHOT') {
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

        response = await fetch('/api/chat', {
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
        
        try {
          data = await response.json();
        } catch (e) {
          throw new Error('Received invalid JSON from server on screenshot request.');
        }
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
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
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
