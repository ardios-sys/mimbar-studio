/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Home, 
  Library, 
  Settings, 
  Sparkles, 
  ChevronLeft, 
  Maximize2, 
  Type,
  Clock,
  Bookmark,
  Share2,
  Play,
  Users,
  Volume2,
  Copy,
  CheckCircle2,
  ChevronRight,
  List,
  FileText,
  Pause,
  FastForward,
  Trash2,
  Download,
  CheckCircle,
  Rewind,
  Eye,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import Markdown from "react-markdown";

// Make html2canvas available globally for jsPDF's html() method
if (typeof window !== 'undefined') {
  (window as any).html2canvas = html2canvas;
}

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

type SermonType = 'Khutbah Jumat' | 'Ceramah' | 'Takziah' | 'Kultum' | 'Khutbah Nikah' | 'Khutbah Hari Raya';
type HariRayaType = 'Idul Fitri' | 'Idul Adha';
type Audience = 'Umum' | 'Remaja' | 'Orang Tua' | 'Anak-anak' | 'Bapak-bapak' | 'Ibuk-ibuk';
type Duration = '5 Menit' | '7 Menit' | '10 Menit' | '15 Menit' | '20 Menit' | '25 Menit' | '30 Menit' | '60 Menit';
type Tone = 'Serius' | 'Humoris' | 'Menyentuh Hati' | 'Akademis' | 'Santai';

interface SavedSermon {
  id: string;
  title: string;
  content: string;
  type: string;
  topic: string;
  date: string;
}

export default function App() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [sermonResult, setSermonResult] = useState<string | null>(null);
  const [isMimbarMode, setIsMimbarMode] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [copied, setCopied] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedSermons, setSavedSermons] = useState<SavedSermon[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'library'>('home');
  const [viewingSavedSermon, setViewingSavedSermon] = useState<SavedSermon | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfPreviewRef = useRef<HTMLDivElement>(null);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  useEffect(() => {
    const saved = localStorage.getItem('zalemika_saved_sermons');
    if (saved) {
      try {
        setSavedSermons(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved sermons", e);
      }
    }
  }, []);

  const saveSermon = () => {
    if (!sermonResult || !selectedTitle) return;
    
    const newSermon: SavedSermon = {
      id: Date.now().toString(),
      title: selectedTitle,
      content: sermonResult,
      type: sType === 'Khutbah Hari Raya' ? `Khutbah Hari Raya ${hariRayaType}` : sType,
      topic: topic,
      date: new Date().toISOString()
    };

    const updated = [newSermon, ...savedSermons];
    setSavedSermons(updated);
    localStorage.setItem('zalemika_saved_sermons', JSON.stringify(updated));
    alert("Khutbah berhasil disimpan ke pustaka!");
  };

  const deleteSermon = (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus khutbah ini?")) {
      const updated = savedSermons.filter(s => s.id !== id);
      setSavedSermons(updated);
      localStorage.setItem('zalemika_saved_sermons', JSON.stringify(updated));
    }
  };

  useEffect(() => {
    let interval: any;
    if (isScrolling && scrollRef.current) {
      interval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isScrolling, scrollSpeed]);

  // Advanced Config States
  const [sType, setSType] = useState<SermonType>('Khutbah Jumat');
  const [hariRayaType, setHariRayaType] = useState<HariRayaType>('Idul Fitri');
  const [audience, setAudience] = useState<Audience>('Umum');
  const [duration, setDuration] = useState<Duration>('10 Menit');
  const [tone, setTone] = useState<Tone>('Serius');

  const generateTitles = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setTitles([]);
    setSelectedTitle(null);
    setSermonResult(null);
    
    try {
      const model = "gemini-3-flash-preview";
      const actualType = sType === 'Khutbah Hari Raya' ? `Khutbah Hari Raya ${hariRayaType}` : sType;
      const prompt = `Berikan 10 pilihan judul yang menarik, kreatif, dan relevan untuk ${actualType} dengan tema "${topic}". 
      Target Audiens: ${audience}.
      Nada Bicara: ${tone}.
      Berikan daftar judul saja, satu per baris, tanpa nomor urut atau penjelasan tambahan.`;

      const result = await genAI.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: prompt }] }],
      });
      
      const generatedTitles = (result.text || "")
        .split('\n')
        .filter(t => t.trim().length > 0)
        .slice(0, 10);
      
      setTitles(generatedTitles);
    } catch (error) {
      console.error("Error generating titles:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFullSermon = async (title: string) => {
    setSelectedTitle(title);
    setIsGenerating(true);
    try {
      const model = "gemini-3-flash-preview";
      const actualType = sType === 'Khutbah Hari Raya' ? `Khutbah Hari Raya ${hariRayaType}` : sType;
      
      let specificInstructions = "";
      if (sType === 'Khutbah Jumat') {
        specificInstructions = `
        STRUKTUR KHUTBAH JUMAT (WAJIB):
        1. KHUTBAH PERTAMA:
           - Mukadimah ARAB: Mulai dengan Hamdalah (Pujian pada Allah), Shalawat Nabi, Wasiat Taqwa. Sebelum Ayat Al-Qur'an di Mukadimah ini, WAJIB tuliskan "Qalallahu Ta'ala...", Ta'awwudz ("A'udzubillahi minash-shaitanir-rajim"), dan Basmalah ("Bismillahirrahmanirrahim") dalam bahasa Arab. Tutup bagian Arab ini dengan kalimat "Shodaqallahul 'azhim".
           - Mukadimah INDONESIA: Lanjutkan dengan Pujian, Shalawat, dan Wasiat Taqwa dalam Bahasa Indonesia secara berurutan (JANGAN mengartikan Mukadimah Arab di atas, buat kalimat baru yang relevan). Pastikan Wasiat Taqwa tertulis jelas setelah Shalawat dalam Bahasa Indonesia.
           - ISI MATERI: Sampaikan seluruh isi materi di Khutbah Pertama ini. 
             * WAJIB menyertakan Ayat Al-Qur'an, Hadits, dan Kisah Hikmah/Inspiratif.
             * JUMLAH & PENEMPATAN: Sertakan satu atau lebih Ayat Al-Qur'an dan Hadits dalam teks Arab (beserta terjemahannya). Sesuaikan jumlahnya dengan durasi ${duration}. Jika durasi panjang, berikan lebih banyak referensi (masing-masing bisa lebih dari satu). Tempatkan Ayat dan Hadits secara strategis mengikuti alur pembahasan agar isi materi kuat dan berkesinambungan.
             * FORMAT AYAT & HADITS: Di bagian ISI MATERI ini, JANGAN gunakan pengantar seperti "Qalallahu Ta'ala", Ta'awwudz, Basmalah, atau "Qala Rasulullah". Langsung tuliskan teks Arab Ayat atau Haditsnya saja.
           - PENUTUP KHUTBAH PERTAMA: Doa singkat/permohonan ampun (Duduk di antara dua khutbah).
        2. KHUTBAH KEDUA:
           - SELURUHNYA DALAM BAHASA ARAB.
           - Urutan: Hamdalah, Shalawat, Wasiat Taqwa, Ayat Al-Qur'an + "Innallaha wa mala'ikatahu yushalluna 'alan nabi..." sampai selesai.
           - Lanjutkan dengan Shalawat akhir dan Doa Penutup yang lengkap dalam Bahasa Arab.
           - Akhiri dengan Penutup Jumat (Ibadallah... dst).`;
      } else if (sType === 'Khutbah Hari Raya') {
        specificInstructions = `
        STRUKTUR KHUTBAH HARI RAYA (WAJIB):
        1. KHUTBAH PERTAMA:
           - TAKBIR: Mulai dengan Takbir "Allahu Akbar" sebanyak 9 kali (Teks Arab).
           - LANJUTAN TAKBIR ARAB: "Allahu akbar kabira, walhamdulillahi katsira, wa subhanallahi bukrataw wa ashila... walau karihal kafirun" (Teks Arab).
           - MUKADIMAH ARAB: Lanjutkan dengan Hamdalah (Pujian), Shalawat Nabi, Wasiat Taqwa, Ta'awwudz, Basmalah, dan Ayat Al-Qur'an. Tutup dengan "Shadaqallahul 'azhim" (Semuanya dalam Teks Arab).
           - MUKADIMAH INDONESIA: Lanjutkan dengan Pujian, Shalawat, dan Wasiat Taqwa dalam Bahasa Indonesia (JANGAN mengartikan teks Arab di atas, buat kalimat baru yang relevan).
           - ISI MATERI: Sampaikan isi khutbah yang panjang dan mendalam.
             * WAJIB menyertakan Ayat Al-Qur'an, Hadits, dan Kisah Hikmah/Inspiratif.
             * FORMAT AYAT & HADITS: Langsung tuliskan teks Arab Ayat atau Haditsnya saja tanpa pengantar "Qalallahu Ta'ala" dsb.
           - PENUTUP KHUTBAH PERTAMA: Doa singkat/permohonan ampun.
        2. KHUTBAH KEDUA:
           - TAKBIR: Mulai dengan Takbir "Allahu Akbar" sebanyak 7 kali (Teks Arab).
           - LANJUTAN TAKBIR ARAB: "Allahu akbar kabira, walhamdulillahi katsira, wa subhanallahi bukrataw wa ashila... walillahilhamd" (Teks Arab).
           - MUKADIMAH ARAB: Lanjutkan dengan Hamdalah, Shalawat, Wasiat Taqwa, Ta'awwudz, Basmalah, dan Ayat Al-Qur'an (Semuanya dalam Teks Arab).
           - ISI MATERI: Sampaikan isi khutbah yang pendek dan padat sebagai kesimpulan.
           - TRANSISI DOA: Tuliskan "Innallaha wa mala'ikatahu yushalluna 'alan nabi... taslima" (Teks Arab).
           - DOA:
             * Mulai dengan "Allahummaghfirlil muslimina wal muslimat..." (Teks Arab).
             * Sambungkan dengan Doa dalam Bahasa Indonesia yang sangat menyentuh hati dan relevan dengan tema.
             * Lanjutkan dengan Doa Sapu Jagad "Rabbana atina fiddunya hasanah..." (Teks Arab).
           - PENUTUP: Tuliskan kalimat penutup khutbah standar dalam Bahasa Arab.`;
      } else if (['Ceramah', 'Kultum', 'Takziah'].includes(sType)) {
        specificInstructions = `
        ATURAN KONTEN (WAJIB):
        1. JANGAN gunakan "Assalamu'alaikum" di awal.
        2. MUKADIMAH (URUTAN WAJIB):
           - Pertama: Tuliskan Mukadimah dalam bahasa Arab (Teks Arab) yang berisi Hamdalah (Pujian), Shalawat Nabi, Syahadat ("Asyhadu alla ilaha..."), "La nabiyya ba'da", dan ditutup dengan "Amma ba'du".
           - Kedua: Tuliskan kata "Hadirin..." sebagai transisi.
           - Ketiga: Lanjutkan dengan Pujian dan Shalawat dalam Bahasa Indonesia (JANGAN mengartikan teks Arab di atas, buat kalimat pembuka baru yang relevan dalam Bahasa Indonesia).
        3. ISI MATERI: 
           - WAJIB menyertakan Ayat Al-Qur'an, Hadits, dan Kisah Hikmah/Inspiratif yang relevan (tuliskan teks Arab untuk Ayat/Hadits beserta terjemahannya).
           - JUMLAH & PENEMPATAN: Sertakan satu atau lebih Ayat Al-Qur'an dan Hadits dalam teks Arab. Sesuaikan jumlahnya dengan durasi ${duration}. Jika durasi panjang, sertakan lebih banyak referensi (masing-masing bisa lebih dari satu). Tempatkan Ayat dan Hadits secara strategis mengikuti alur pembahasan agar isi tetap padat, menarik, dan berkesinambungan.
           - FORMAT AYAT & HADITS: Di bagian ISI MATERI ini, JANGAN gunakan pengantar seperti "Qalallahu Ta'ala", Ta'awwudz, Basmalah, atau "Qala Rasulullah". Langsung tuliskan teks Arab Ayat atau Haditsnya saja.
        4. PENUTUP: Doa yang sesuai dengan jenis teks.`;
      } else {
        specificInstructions = `
        ATURAN KONTEN (WAJIB):
        1. MULAI LANGSUNG dengan Mukadimah dalam bahasa Arab (Teks Arab). 
           - Gunakan Mukadimah bahasa Arab sampai Shalawat saja.
        2. ISI MATERI: 
           - WAJIB menyertakan Ayat Al-Qur'an, Hadits, dan Kisah Hikmah/Inspiratif yang relevan (tuliskan teks Arab untuk Ayat/Hadits beserta terjemahannya).
           - JUMLAH & PENEMPATAN: Sertakan satu atau lebih Ayat Al-Qur'an dan Hadits dalam teks Arab. Sesuaikan jumlahnya dengan durasi ${duration}. Jika durasi panjang, sertakan lebih banyak referensi (masing-masing bisa lebih dari satu). Tempatkan Ayat dan Hadits secara strategis mengikuti alur pembahasan agar isi tetap padat, menarik, dan berkesinambungan.
           - FORMAT AYAT & HADITS: Di bagian ISI MATERI ini, JANGAN gunakan pengantar seperti "Qalallahu Ta'ala", Ta'awwudz, Basmalah, atau "Qala Rasulullah". Langsung tuliskan teks Arab Ayat atau Haditsnya saja.
        3. PENUTUP: Doa yang sesuai dengan jenis teks.`;
      }

      const prompt = `Buatkan teks ${actualType} lengkap dengan judul spesifik: "${title}". 
      Tema Dasar: ${topic}.
      Target Audiens: ${audience}.
      Estimasi Durasi: ${duration}.
      Nada Bicara (Tone): ${tone}.
      
      ${specificInstructions}
      
      KETENTUAN UMUM:
      - JANGAN menuliskan kalimat pengantar seperti "Berikut adalah teks..." atau "Ini adalah hasil...". Langsung mulai dari teks Mukadimah Arab.
      - Gunakan bahasa yang ${tone === 'Humoris' ? 'segar dan ada sedikit humor ringan' : tone === 'Menyentuh Hati' ? 'sangat emosional dan menyentuh perasaan' : tone === 'Santai' ? 'santai, akrab, dan mudah dimengerti' : 'formal dan akademis'}.
      - Tambahkan instruksi retorika dalam kurung siku seperti [Jeda Sejenak] atau [Tekankan Bagian Ini] di tempat yang tepat.
      - Format dengan Markdown yang rapi.`;

      const result = await genAI.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: prompt }] }],
      });
      
      setSermonResult(result.text || "Gagal menghasilkan teks.");
    } catch (error) {
      console.error("Error generating sermon:", error);
      setSermonResult("Terjadi kesalahan saat menghubungi AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (sermonResult) {
      navigator.clipboard.writeText(sermonResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetFlow = () => {
    setSermonResult(null);
    setTitles([]);
    setSelectedTitle(null);
    setIsScrolling(false);
  };

  const downloadPDF = () => {
    if (!sermonResult || !selectedTitle) return;
    setShowPdfPreview(true);
  };

  const savePDF = async () => {
    if (!pdfPreviewRef.current || !selectedTitle) return;
    setIsSavingPdf(true);
    
    // Create a new jsPDF instance
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const element = pdfPreviewRef.current;
    
    // Temporarily remove scaling for capture
    const originalStyle = element.style.transform;
    element.style.transform = 'none';
    
    try {
      await doc.html(element, {
        callback: function (doc) {
          doc.save(`${selectedTitle.replace(/\s+/g, '_')}.pdf`);
          setShowPdfPreview(false);
        },
        x: 10,
        y: 10,
        width: 190, // A4 width (210) - margins (10+10)
        windowWidth: 800, // Fixed window width for consistent rendering
        autoPaging: 'text',
        html2canvas: {
          scale: 1,
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true
        }
      });
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Gagal menyimpan PDF. Silakan coba lagi.");
    } finally {
      // Restore original scaling
      element.style.transform = originalStyle;
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="flex justify-center bg-[#121212] min-h-screen font-sans">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-[450px] bg-[#F8FAF9] shadow-2xl flex flex-col relative overflow-hidden h-screen">
        
        {/* Status Bar */}
        <div className="h-8 bg-white flex items-center justify-between px-6 text-[10px] font-bold text-gray-400">
          <span>10:30</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full border border-gray-300" />
            <div className="w-3 h-3 rounded-full border border-gray-300" />
          </div>
        </div>

        {/* Header */}
        <header className="px-6 py-4 bg-white flex items-center justify-between border-b border-gray-100">
          {(titles.length > 0 || sermonResult) && !isMimbarMode ? (
            <button onClick={resetFlow} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#059669] rounded-lg flex items-center justify-center">
                <BookOpen className="text-white w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-[#1A1C1E]">Zalemika Mimbar AI</h1>
            </div>
          )}
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentView(currentView === 'home' ? 'library' : 'home')}
              className={`p-2 rounded-full transition-colors ${currentView === 'library' ? 'bg-[#059669] text-white' : 'hover:bg-gray-100'}`}
            >
              <Library size={20} />
            </button>
            {sermonResult && (
              <button 
                onClick={() => setIsMimbarMode(!isMimbarMode)}
                className={`p-2 rounded-full transition-colors ${isMimbarMode ? 'bg-[#059669] text-white' : 'hover:bg-gray-100'}`}
              >
                <Maximize2 size={20} />
              </button>
            )}
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {currentView === 'library' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">Pustaka Khutbah</h2>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  {savedSermons.length} Tersimpan
                </span>
              </div>
              
              {savedSermons.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-gray-200">
                  <Bookmark size={48} className="mx-auto mb-4 text-gray-200" />
                  <p className="text-gray-400 font-medium">Belum ada khutbah yang disimpan</p>
                  <button 
                    onClick={() => setCurrentView('home')}
                    className="mt-4 text-emerald-600 font-bold text-sm"
                  >
                    Mulai Buat Sekarang
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedSermons.map((s) => (
                    <motion.div 
                      key={s.id}
                      layout
                      className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          {s.type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(s.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight mb-4">{s.title}</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSermonResult(s.content);
                            setSelectedTitle(s.title);
                            setCurrentView('home');
                          }}
                          className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold rounded-xl text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Eye size={16} /> Lihat
                        </button>
                        <button 
                          onClick={() => deleteSermon(s.id)}
                          className="p-3 bg-red-50 text-red-500 rounded-xl active:scale-95 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
            {titles.length === 0 && !sermonResult ? (
              <motion.div 
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6 pb-6"
              >
                <div className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-xl shadow-gray-100 space-y-6">
                  <div className="flex items-center gap-2 text-[#059669]">
                    <Sparkles size={20} />
                    <h2 className="text-lg font-bold">Zalemika Mimbar AI</h2>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tema Utama</label>
                    <input 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Contoh: Keutamaan Sabar"
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#059669] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                        <BookOpen size={10} /> Jenis Teks
                      </label>
                      <select 
                        value={sType}
                        onChange={(e) => setSType(e.target.value as SermonType)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none"
                      >
                        {['Khutbah Jumat', 'Ceramah', 'Takziah', 'Kultum', 'Khutbah Nikah', 'Khutbah Hari Raya'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {sType === 'Khutbah Hari Raya' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                          <Sparkles size={10} /> Jenis Hari Raya
                        </label>
                        <select 
                          value={hariRayaType}
                          onChange={(e) => setHariRayaType(e.target.value as HariRayaType)}
                          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none"
                        >
                          {['Idul Fitri', 'Idul Adha'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                        <Users size={10} /> Audiens
                      </label>
                      <select 
                        value={audience}
                        onChange={(e) => setAudience(e.target.value as Audience)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none"
                      >
                        {['Umum', 'Remaja', 'Orang Tua', 'Anak-anak', 'Bapak-bapak', 'Ibuk-ibuk'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> Durasi
                      </label>
                      <select 
                        value={duration}
                        onChange={(e) => setDuration(e.target.value as Duration)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none"
                      >
                        {['5 Menit', '7 Menit', '10 Menit', '15 Menit', '20 Menit', '25 Menit', '30 Menit', '60 Menit'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                        <Volume2 size={10} /> Nada Bicara
                      </label>
                      <select 
                        value={tone}
                        onChange={(e) => setTone(e.target.value as Tone)}
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none"
                      >
                        {['Serius', 'Humoris', 'Menyentuh Hati', 'Akademis', 'Santai'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={generateTitles}
                    disabled={isGenerating || !topic}
                    className="w-full py-4 bg-[#059669] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <List size={20} />
                        <span>Cari Pilihan Judul</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : titles.length > 0 && !sermonResult ? (
              <motion.div 
                key="titles"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-6 bg-[#059669] rounded-full" />
                  <h2 className="text-lg font-bold text-gray-800">Pilih Judul Terbaik</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4 italic">Berdasarkan tema: "{topic}"</p>
                
                <div className="space-y-3">
                  {titles.map((title, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                      onClick={() => generateFullSermon(title)}
                      disabled={isGenerating}
                      className="w-full p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between text-left shadow-sm hover:border-[#059669] hover:bg-emerald-50 transition-all active:scale-[0.98]"
                    >
                      <span className="text-sm font-semibold text-gray-700 pr-4">{title}</span>
                      <ChevronRight size={18} className="text-gray-300 shrink-0" />
                    </motion.button>
                  ))}
                </div>

                {isGenerating && (
                  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-[32px] flex flex-col items-center gap-4 shadow-2xl">
                      <div className="w-12 h-12 border-4 border-emerald-100 border-t-[#059669] rounded-full animate-spin" />
                      <p className="text-sm font-bold text-[#059669]">Menyusun Materi...</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col h-full ${isMimbarMode ? 'bg-[#1A1C1E] text-white' : 'bg-white'}`}
              >
                {/* Mimbar Mode Controls */}
                {isMimbarMode && (
                  <div className="p-4 border-b border-white/10 flex flex-col gap-4 sticky top-0 bg-[#1A1C1E] z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Type size={18} className="text-emerald-400" />
                        <input 
                          type="range" 
                          min="16" max="44" 
                          value={fontSize} 
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          className="w-20 accent-emerald-500"
                        />
                        <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-emerald-400">
                          {duration}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setScrollSpeed(Math.max(0.5, scrollSpeed - 0.5))}
                          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white"
                        >
                          <Rewind size={14} />
                        </button>
                        <button 
                          onClick={() => setIsScrolling(!isScrolling)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-colors ${isScrolling ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}
                        >
                          {isScrolling ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                          {isScrolling ? 'Stop' : 'Scroll'}
                        </button>
                        <button 
                          onClick={() => setScrollSpeed(Math.min(10, scrollSpeed + 0.5))}
                          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white"
                        >
                          <FastForward size={14} />
                        </button>
                      </div>
                    </div>
                    {isScrolling && (
                      <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-mono">
                        Speed: {scrollSpeed.toFixed(1)}x
                      </div>
                    )}
                  </div>
                )}

                <div 
                  ref={scrollRef}
                  className={`flex-1 p-8 overflow-y-auto leading-relaxed pb-32`} 
                  style={{ fontSize: `${fontSize}px` }}
                >
                  <h1 className={`text-2xl font-bold mb-6 ${isMimbarMode ? 'text-emerald-400' : 'text-[#059669]'}`}>
                    {selectedTitle}
                  </h1>
                  <div className="max-w-none space-y-4 markdown-body">
                    <Markdown
                      components={{
                        p: ({ children }) => {
                          const text = String(children);
                          if (isArabic(text)) {
                            return <p className="arabic-text text-3xl py-2 leading-relaxed">{children}</p>;
                          }
                          if (text.startsWith('[') && text.endsWith(']')) {
                            return <p className="text-emerald-500 font-bold italic text-sm opacity-80 my-2">{children}</p>;
                          }
                          return <p>{children}</p>;
                        },
                        li: ({ children }) => {
                          const text = String(children);
                          if (isArabic(text)) {
                            return <li className="arabic-text text-2xl py-1 leading-relaxed">{children}</li>;
                          }
                          return <li>{children}</li>;
                        }
                      }}
                    >
                      {sermonResult}
                    </Markdown>
                  </div>
                </div>

                {!isMimbarMode && (
                  <div className="p-6 border-t border-gray-100 flex gap-3 bg-white">
                    <button 
                      onClick={copyToClipboard}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {copied ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Copy size={18} />}
                      {copied ? "Tersalin" : "Salin Teks"}
                    </button>
                    <button 
                      onClick={downloadPDF}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Download size={18} />
                      PDF
                    </button>
                    <button 
                      onClick={saveSermon}
                      className="flex-1 py-4 bg-[#059669] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
                    >
                      <Bookmark size={18} />
                      Simpan
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>

        {/* Android Navigation Bar */}
        <div className="h-6 bg-white flex items-center justify-center gap-12 pb-2 shrink-0">
          <div className="w-3 h-3 border-2 border-gray-300 rounded-sm rotate-45" />
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
          <div className="w-3.5 h-3.5 border-2 border-gray-300 rounded-sm" />
        </div>
        {/* PDF Preview Modal */}
        <AnimatePresence>
          {showPdfPreview && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-[500px] h-[85vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Preview PDF</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Format A4 • High Quality</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPdfPreview(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-gray-100 p-4">
                  {/* The actual element to be captured */}
                  <div className="flex justify-center min-w-max">
                    <div 
                      ref={pdfPreviewRef}
                      className="bg-white shadow-sm markdown-body text-black origin-top scale-[0.4] sm:scale-[0.5] md:scale-[0.7] lg:scale-100"
                      style={{ 
                        width: '210mm', // Full A4 width
                        minHeight: '297mm', // Full A4 height
                        padding: '25.4mm', // Standard 1-inch Word margin
                        fontSize: '12pt',
                        lineHeight: '1.6', // Standard Word line spacing
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        fontFamily: '"Times New Roman", Times, serif' // More Word-like
                      }}
                    >
                      {/* Word-like Header */}
                      <div className="flex justify-between items-center mb-10 border-b pb-2" style={{ borderColor: '#000000', borderWidth: '0.5pt' }}>
                        <span style={{ fontSize: '10pt', color: '#000000', fontWeight: 'bold', textTransform: 'uppercase' }}>
                          Zalemika Mimbar AI
                        </span>
                        <span style={{ fontSize: '10pt', color: '#000000' }}>
                          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>

                      <h1 className="text-center font-bold mb-10" style={{ fontSize: '22pt', color: '#000000', lineHeight: '1.2', textTransform: 'uppercase' }}>
                        {selectedTitle}
                      </h1>

                      <Markdown
                        components={{
                          p: ({ children }) => {
                            const text = String(children);
                            if (isArabic(text)) {
                              return <p className="arabic-text text-4xl py-6 leading-[2.8]" style={{ textAlign: 'right', fontFamily: '"Amiri", serif' }}>{children}</p>;
                            }
                            return <p className="mb-4 text-justify" style={{ textIndent: '1cm' }}>{children}</p>;
                          },
                          li: ({ children }) => {
                            const text = String(children);
                            if (isArabic(text)) {
                              return <li className="arabic-text text-3xl py-3 leading-[2.8]" style={{ textAlign: 'right', fontFamily: '"Amiri", serif' }}>{children}</li>;
                            }
                            return <li className="mb-2 text-justify ml-4">{children}</li>;
                          },
                          h2: ({ children }) => (
                            <h2 className="font-bold mt-8 mb-4 border-b pb-1" style={{ fontSize: '16pt', color: '#000000', borderColor: '#000000', borderWidth: '1pt' }}>{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="font-bold mt-6 mb-3" style={{ fontSize: '14pt', color: '#000000' }}>{children}</h3>
                          )
                        }}
                      >
                        {sermonResult}
                      </Markdown>

                      {/* Word-like Footer */}
                      <div className="mt-20 pt-4 border-t flex justify-between items-center" style={{ borderColor: '#000000', borderWidth: '0.5pt', fontSize: '10pt', color: '#000000' }}>
                        <span>Dokumen Khutbah Digital - Zalemika Mimbar AI</span>
                        <span>Dicetak pada: {new Date().toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
                  <button 
                    onClick={() => setShowPdfPreview(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={savePDF}
                    disabled={isSavingPdf}
                    className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingPdf ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    {isSavingPdf ? 'Menyimpan...' : 'Simpan PDF'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
