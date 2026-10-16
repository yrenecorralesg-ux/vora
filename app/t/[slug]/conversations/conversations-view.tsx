'use client';

import React, { useState } from 'react';
import {
  Search,
  MoreVertical,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Send,
  ShoppingBag,
  CheckCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CrmHeader } from '@/components/crm-header';
import { ImagePlaceholder } from '@/components/image-placeholder';

export interface ChatThread {
  id: string;
  initials: string;
  avatarBg: string;
  name: string;
  lastMessage: string;
  badge: 'Asesora' | 'Consulta';
  badgeColor: string;
  historySummary: string;
  channel: string;
  productContext: string;
  productImg?: string;
}

const THREADS: ChatThread[] = [
  {
    id: 't1',
    initials: 'LM',
    avatarBg: 'bg-indigo-100 text-indigo-700',
    name: 'Laura Méndez',
    lastMessage: 'Quiero pedir otra esencia',
    badge: 'Asesora',
    badgeColor: 'bg-purple-100 text-purple-700',
    historySummary: 'Historial: 8 compras • Difusor Bosque • WhatsApp',
    channel: 'WhatsApp',
    productContext: 'Difusor Bosque + Vela Decorativa',
    productImg: '/solee/prod_difusor.webp',
  },
  {
    id: 't2',
    initials: 'AP',
    avatarBg: 'bg-purple-100 text-purple-700',
    name: 'Andrea Pérez',
    lastMessage: '¿Cuándo llega mi pedido?',
    badge: 'Consulta',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    historySummary: 'Historial: 6 compras • Esencia Calma • Web',
    channel: 'Web',
    productContext: 'Esencia Calma',
    productImg: '/solee/prod_esencia.webp',
  },
  {
    id: 't3',
    initials: 'JS',
    avatarBg: 'bg-emerald-100 text-emerald-700',
    name: 'Julián Salazar',
    lastMessage: '¿Qué aroma recomiendan?',
    badge: 'Consulta',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    historySummary: 'Historial: 1 compra • Tienda virtual • Web',
    channel: 'Web',
    productContext: 'Home Essence',
    productImg: '/solee/prod_vela.webp',
  },
];

export function ConversationsView({
  tenantName,
  secondaryColor,
  ambientImage,
  slug,
}: {
  tenantName: string;
  secondaryColor: string;
  ambientImage?: string | null;
  slug: string;
}) {
  const [selectedThread, setSelectedThread] = useState<ChatThread>(THREADS[0]);
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'client' | 'advisor'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: 'La esencia Bosque está disponible. ¿Te gustaría hablar con una asesora?',
      time: '10:24',
    },
    {
      sender: 'client',
      text: 'Sí, quiero comprar otra.',
      time: '10:25',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTaken, setIsTaken] = useState(false);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      { sender: 'advisor', text: inputText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setInputText('');
    setIsTaken(true);
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header matching Screenshot 4 */}
      <CrmHeader
        tenantName={tenantName}
        title="Atención con toque humano"
        subtitle="El asistente responde consultas; una asesora se encarga del cierre."
        ambientImageUrl={ambientImage}
        secondaryColor={secondaryColor}
      />

      {/* 2-column chat grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Bandeja de entrada */}
        <Card className="overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs lg:col-span-5 flex flex-col h-[580px]">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-bold text-slate-900 text-base">Bandeja de entrada</h3>
            <Search className="h-4 w-4 text-slate-400" />
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {THREADS.map((t) => {
              const active = selectedThread.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedThread(t);
                    setIsTaken(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between p-4 transition-colors ${
                    active ? 'bg-purple-50/50 border-l-4 border-[#5136db]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${t.avatarBg}`}
                    >
                      {t.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 truncate">{t.lastMessage}</p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    <Badge
                      className={`text-[10px] font-semibold ${
                        t.badge === 'Asesora'
                          ? 'bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {t.badge}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Column: Chat Window matching Screenshot 4 */}
        <Card className="flex flex-col justify-between overflow-hidden rounded-2xl border-slate-100 bg-white shadow-xs lg:col-span-7 h-[580px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${selectedThread.avatarBg}`}
              >
                {selectedThread.initials}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedThread.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{selectedThread.historySummary}</span>
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              </div>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Chat Conversation Scroll */}
          <div className="flex-1 space-y-4 p-5 overflow-y-auto">
            {messages.map((m, idx) => {
              if (m.sender === 'bot') {
                return (
                  <div key={idx} className="flex max-w-[85%] items-start gap-2.5">
                    <div className="rounded-2xl rounded-tl-xs bg-purple-50/70 p-4 border border-purple-100/60 text-xs text-slate-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-[#5136db] text-[11px]">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>El asistente:</span>
                      </div>
                      <p>{m.text}</p>
                      <span className="text-[10px] text-slate-400 block text-right">{m.time}</span>
                    </div>
                  </div>
                );
              }

              if (m.sender === 'client') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="rounded-2xl rounded-tr-xs bg-slate-100 p-3.5 text-xs text-slate-800 space-y-1 max-w-[80%]">
                      <p><strong className="text-slate-700">Cliente:</strong> {m.text}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                        <span>{m.time}</span>
                        <CheckCheck className="h-3 w-3 text-purple-600" />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-xs bg-[#5136db] text-white p-3.5 text-xs space-y-1 max-w-[80%] shadow-xs">
                    <p><strong>Asesora:</strong> {m.text}</p>
                    <span className="text-[10px] text-white/70 block text-right">{m.time}</span>
                  </div>
                </div>
              );
            })}

            {/* INTENCIÓN DE COMPRA DETECTADA Card matching mockup */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-200/70 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/30 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 max-w-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-[#5136db]">
                      <ShoppingBag className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5136db]">
                      INTENCIÓN DE COMPRA DETECTADA
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    La asesora recibe la conversación, producto y compras anteriores antes de responder.
                  </p>
                  <div>
                    <Button
                      size="sm"
                      onClick={() => setIsTaken(true)}
                      className={`rounded-xl text-white font-semibold text-xs transition-all ${
                        isTaken ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#5136db] hover:bg-[#432bc2]'
                      }`}
                    >
                      {isTaken ? 'Conversación en curso con asesora ✓' : 'Tomar conversación →'}
                    </Button>
                  </div>
                </div>

                {/* Product image placeholder (No crop) */}
                <div className="shrink-0 w-32 h-24 overflow-hidden rounded-xl bg-white border border-slate-100 p-1">
                  <ImagePlaceholder
                    src={selectedThread.productImg}
                    alt={selectedThread.productContext}
                    aspectRatio="aspect-auto"
                    className="w-full h-full"
                    label="Producto"
                    sublabel=""
                    objectFit="contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="border-t border-slate-100 p-3 bg-white flex items-center gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe una respuesta como asesora..."
              className="rounded-xl border-slate-200 text-xs h-10"
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-xl bg-[#5136db] hover:bg-[#432bc2] text-white h-10 px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
