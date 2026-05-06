/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload,
  FileUp,
  FileCheck,
  FileText,
  Briefcase, 
  ChevronRight, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Loader2,
  Rocket,
  ShieldCheck,
  Coins,
  Download,
  FileDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { optimizeResumeStage, generateCoverLetter, checkDailyLimit, incrementUsage, type OptimizationStage } from './services/geminiService';
import { cn } from './lib/utils';
import { extractTextFromPdf } from './lib/pdfUtils';
import { StaticPage, PrivacyContent, TermsContent, AboutContent } from './components/StaticPages';
import { Shield, FileText as FileTextIcon, Info, HelpCircle, BookOpen, Star } from 'lucide-react';

type Phase = 'INPUT' | 'OPTIMIZING' | 'DEPLOYMENT' | 'COMPLETE';
type StaticPageType = 'HOME' | 'ABOUT' | 'PRIVACY' | 'TERMS';

export default function App() {
  const [phase, setPhase] = useState<Phase>('INPUT');
  const [currentPage, setCurrentPage] = useState<StaticPageType>('HOME');
  const [jdText, setJdText] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [currentStage, setCurrentStage] = useState<OptimizationStage>(1);
  const [stageOutputs, setStageOutputs] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover-letter'>('resume');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'word' | 'cl-word' | null>(null);

  const finalCvRef = useRef<HTMLDivElement>(null);
  const finalClRef = useRef<HTMLDivElement>(null);

  // Deployment metadata
  const [adsClientId, setAdsClientId] = useState('');
  const [cryptoAddress, setCryptoAddress] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsReadingFile(true);
    setCvFileName(file.name);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or .txt file.');
      }
      
      if (!text.trim()) {
        throw new Error('The file appears to be empty or could not be read.');
      }
      
      setCvText(text);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setCvFileName(null);
      setCvText('');
    } finally {
      setIsReadingFile(false);
    }
  };

  const startOptimization = () => {
    const { allowed, remaining } = checkDailyLimit();
    
    if (!allowed) {
      setError("Daily limit reached. You can only perform 5 full optimizations every 24 hours. Please come back tomorrow to continue refining your career path!");
      return;
    }

    if (!jdText.trim() || !cvText.trim()) {
      setError('Please provide both the Job Description and your uploaded CV.');
      return;
    }
    setError(null);
    setPhase('OPTIMIZING');
    runStage(1);
  };

  const runStage = useCallback(async (stage: OptimizationStage) => {
    setIsProcessing(true);
    setError(null);
    try {
      const output = await optimizeResumeStage(stage, cvText, jdText, stageOutputs);
      if (output) {
        setStageOutputs(prev => {
          const newOutputs = [...prev];
          newOutputs[stage - 1] = output;
          return newOutputs;
        });
      }
    } catch (err) {
      console.error("Stage error:", err);
      setError(err instanceof Error ? err.message : 'Optimization failed. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [cvText, jdText, stageOutputs]);

  const approveStage = () => {
    if (currentStage < 6) {
      const nextStage = (currentStage + 1) as OptimizationStage;
      setCurrentStage(nextStage);
      runStage(nextStage);
    } else {
      setPhase('COMPLETE');
    }
  };

  const downloadPdf = async () => {
    if (!finalCvRef.current) return;
    setIsDownloading('pdf');
    try {
      // Get the actual content div inside the ref
      const element = finalCvRef.current;
      
      // Temporary styling to ensure full height is captured
      const originalStyle = element.getAttribute('style');
      const originalParentStyle = element.parentElement?.getAttribute('style');
      
      // Capture the element's full height by removing limits temporarily
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';
      if (element.parentElement) {
        element.parentElement.style.height = 'auto';
        element.parentElement.style.maxHeight = 'none';
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800, // Fixed width for better resume layout
      });

      // Restore original styles
      element.setAttribute('style', originalStyle || '');
      if (element.parentElement) {
        element.parentElement.setAttribute('style', originalParentStyle || '');
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If content is longer than one page, we might need multi-page logic
      // But for now, let's scale to fit or handle first page
      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
        const totalPages = Math.ceil(pdfHeight / pdf.internal.pageSize.getHeight());
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          pdf.addImage(
            imgData, 
            'PNG', 
            0, 
            -(i * pdf.internal.pageSize.getHeight()), 
            pdfWidth, 
            pdfHeight
          );
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save('Optimized_CV.pdf');
    } catch (err) {
      console.error('PDF creation failed', err);
      setError('PDF generation failed. Try printing the page instead.');
    } finally {
      setIsDownloading(null);
    }
  };

  const downloadWord = () => {
    setIsDownloading('word');
    try {
      const content = finalCvRef.current?.innerHTML || '';
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + content + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = 'Optimized_CV.doc';
      fileDownload.click();
      document.body.removeChild(fileDownload);
    } catch (err) {
      console.error('Word creation failed', err);
    } finally {
      setIsDownloading(null);
    }
  };

  const downloadClWord = () => {
    setIsDownloading('cl-word');
    try {
      const content = finalClRef.current?.innerHTML || '';
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + content + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = 'Cover_Letter.doc';
      fileDownload.click();
      document.body.removeChild(fileDownload);
    } catch (err) {
      console.error('Cover Letter Word creation failed', err);
    } finally {
      setIsDownloading(null);
    }
  };

  const finalizeDeployment = () => {
    setPhase('COMPLETE');
  };

  // Auto-progression logic
  useEffect(() => {
    if (phase === 'OPTIMIZING' && !isProcessing && stageOutputs[currentStage - 1]) {
      if (currentStage < 6) {
        const timer = setTimeout(() => {
          const nextStage = (currentStage + 1) as OptimizationStage;
          setCurrentStage(nextStage);
          runStage(nextStage);
        }, 3000); // 3 second delay to let user see the result
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(async () => {
          setIsProcessing(true);
          try {
            const cl = await generateCoverLetter(stageOutputs[5], jdText);
            setCoverLetter(cl);
            incrementUsage();
          } catch (err) {
            console.error("Cover letter generation failed", err);
          } finally {
            setIsProcessing(false);
            setPhase('COMPLETE');
          }
        }, 4000); // 4 second delay after final stage
        return () => clearTimeout(timer);
      }
    }
  }, [phase, isProcessing, currentStage, stageOutputs, runStage, jdText]);

  const renderProgress = () => (
    <div className="flex items-center space-x-2 mb-8">
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <div key={s} className="flex items-center">
          <div 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
              currentStage === s ? "bg-black text-white scale-110 shadow-lg" : 
              currentStage > s ? "bg-green-100 text-green-600" : "bg-neutral-200 text-neutral-400"
            )}
          >
            {currentStage > s ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < 6 && <div className={cn("w-4 h-px mx-1", currentStage > s ? "bg-green-200" : "bg-neutral-200")} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-premium-bg flex flex-col items-center py-16 px-4 selection:bg-premium-accent/10">
      <div className="max-w-5xl w-full">
        {currentPage === 'HOME' ? (
          <>
            {/* Header */}
            <header className="mb-16 text-center">
            <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center bg-premium-black text-white px-4 py-1.5 rounded-full text-[10px] font-bold mb-4 tracking-[0.2em] uppercase"
          >
            <Sparkles className="w-3.5 h-3.5 mr-2 text-premium-accent" />
            Intelligence-Driven Optimization
          </motion.div>
          
          <div className="mb-6">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] bg-slate-100/50 px-3 py-1 rounded-lg">
              Daily Credits: {checkDailyLimit().remaining} / 5 Remaining
            </span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-serif italic font-bold text-premium-black tracking-tighter mb-6 relative inline-block">
            CareerFlow
            <span className="absolute -top-4 -right-12 font-display not-italic text-xs bg-premium-accent text-white px-2 py-0.5 rounded italic tracking-normal">v2.0</span>
          </h1>
          
          <p className="text-premium-gray max-w-2xl mx-auto text-lg leading-relaxed font-light">
            An elite 6-stage refinement engine that transforms your professional background into a high-impact narrative tailored for top-tier hiring managers.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {phase === 'INPUT' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white p-10 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-premium-black font-bold uppercase tracking-widest text-xs">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3">
                        <Briefcase className="w-4 h-4 text-premium-black" />
                      </div>
                      Target Opportunity
                    </div>
                  </div>
                  <textarea
                    placeholder="Paste the target Job Description or requirements here..."
                    className="w-full h-80 p-5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-premium-accent/20 focus:border-premium-accent/40 transition-all outline-none text-sm leading-relaxed placeholder:text-slate-300"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-premium-black font-bold uppercase tracking-widest text-xs">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3">
                        <FileText className="w-4 h-4 text-premium-black" />
                      </div>
                      Current Credentials
                    </div>
                  </div>
                  
                  <label 
                    className={cn(
                      "w-full h-80 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all gap-5 px-8 text-center",
                      cvText ? "bg-blue-50/30 border-premium-accent/30" : "bg-slate-50/50 border-slate-200 hover:border-premium-black hover:bg-slate-100/50",
                      isReadingFile && "animate-pulse opacity-50 cursor-wait"
                    )}
                  >
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.txt" 
                      onChange={handleFileUpload}
                      disabled={isReadingFile}
                    />
                    
                    {isReadingFile ? (
                      <Loader2 className="w-12 h-12 text-slate-300 animate-spin" />
                    ) : cvText ? (
                      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                        <div className="bg-premium-accent/10 p-5 rounded-full mb-4">
                          <FileCheck className="w-10 h-10 text-premium-accent" />
                        </div>
                        <p className="font-bold text-premium-black max-w-[200px] truncate">{cvFileName}</p>
                        <p className="text-sm text-premium-accent font-medium mt-1 uppercase tracking-wide">Analysis Ready</p>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setCvText('');
                            setCvFileName(null);
                          }}
                          className="mt-4 text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
                        >
                          Change File
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        <div className="bg-white p-5 rounded-full shadow-sm border border-slate-100">
                          <FileUp className="w-10 h-10 text-slate-300" />
                        </div>
                        <div>
                          <p className="font-bold text-premium-black text-lg">Source Document</p>
                          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                            Upload your existing resume in PDF or Text format to begin the extraction.
                          </p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
              </div>
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 flex items-center bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100"
                >
                  <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <button
                onClick={startOptimization}
                disabled={isReadingFile}
                className="w-full mt-10 bg-premium-black hover:bg-slate-800 text-white py-5 rounded-2xl font-bold tracking-wide transition-all transform hover:scale-[1.005] active:scale-[0.99] flex items-center justify-center shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                Launch Optimization Framework
                <ChevronRight className="ml-2 w-5 h-5 opacity-50" />
              </button>
            </motion.div>
          )}

          {phase === 'OPTIMIZING' && (
            <motion.div
              key="optimizing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col items-center w-full"
            >
              <div className="mb-12 w-full max-w-2xl px-4">
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-slate-200 -z-10" />
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <motion.div 
                      key={s} 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: s * 0.1 }}
                      className="flex flex-col items-center gap-3 bg-premium-bg"
                    >
                      <div 
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2",
                          currentStage === s ? "bg-premium-black text-white border-premium-black scale-125 shadow-lg shadow-premium-black/20" : 
                          currentStage > s ? "bg-white text-premium-accent border-premium-accent" : "bg-white text-slate-300 border-slate-200"
                        )}
                      >
                        {currentStage > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 min-h-[650px] flex flex-col overflow-hidden relative">
                {/* Stage Indicator Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: `${(currentStage / 6) * 100}%` }}
                    className="h-full bg-premium-accent transition-all duration-1000 ease-in-out"
                  />
                </div>

                <div className="px-10 py-12 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
                    <div>
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Optimization Phase {currentStage}
                      </div>
                      <h2 className="text-3xl font-display font-bold text-premium-black tracking-tight">
                        {currentStage === 1 && "Strategic Rewrite"}
                        {currentStage === 2 && "Experience Alignment"}
                        {currentStage === 3 && "Keyword Engineering"}
                        {currentStage === 4 && "Narrative Structuring"}
                        {currentStage === 5 && "Executive Polish"}
                        {currentStage === 6 && "Final Review Cycle"}
                      </h2>
                    </div>
                    {isProcessing && (
                      <div className="flex items-center text-premium-accent text-sm font-bold tracking-wider">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        PROCESSING
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
                    {stageOutputs[currentStage - 1] ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="markdown-body p-4"
                      >
                        <ReactMarkdown>{stageOutputs[currentStage - 1]}</ReactMarkdown>
                      </motion.div>
                    ) : !isProcessing ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                        {error ? (
                          <div className="flex flex-col items-center p-10 text-center bg-red-50/50 rounded-3xl border border-red-100 max-w-md">
                            <AlertCircle className="w-14 h-14 text-red-500 mb-5" />
                            <h3 className="text-red-900 font-bold mb-3 uppercase text-sm tracking-widest">Protocol Failure</h3>
                            <p className="text-red-600 text-sm mb-8 leading-relaxed">
                              {error}
                            </p>
                            <button 
                              onClick={() => runStage(currentStage)}
                              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Retry Sequence
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <div className="absolute inset-0 bg-slate-100 animate-ping rounded-full scale-150 opacity-20" />
                              <Loader2 className="w-16 h-16 text-slate-200 animate-spin relative" />
                            </div>
                            <p className="font-medium tracking-wide">Initializing secure engine...</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6 bg-slate-50/30 rounded-3xl">
                        <div className="relative">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                            className="w-24 h-24 border-4 border-dashed border-slate-200 rounded-full flex items-center justify-center"
                          >
                            <Sparkles className="w-10 h-10 text-premium-accent/40" />
                          </motion.div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-premium-black tracking-widest text-xs uppercase mb-2">Stage {currentStage} in Progress</p>
                          <p className="text-sm font-light italic leading-loose opacity-70">Synthesizing professional background with market requirements...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-12 flex items-center gap-6 pt-8 border-t border-slate-50">
                    <button
                      onClick={() => setPhase('INPUT')}
                      className="group flex items-center bg-slate-100 hover:bg-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-bold text-sm transition-all"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                      Abort
                    </button>
                    
                    <button
                      onClick={approveStage}
                      disabled={!stageOutputs[currentStage - 1] || isProcessing}
                      className="flex-1 bg-premium-black hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-slate-200 flex items-center justify-center relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center tracking-wide">
                        {currentStage === 6 ? "Finalizing Report" : "Proceed to Next Stage"}
                        <ChevronRight className="ml-2 w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                      </span>
                      {!isProcessing && stageOutputs[currentStage - 1] && (
                        <motion.div 
                          initial={{ x: "-100%" }}
                          animate={{ x: "0%" }}
                          transition={{ duration: currentStage === 6 ? 4 : 3, ease: "linear" }}
                          className="absolute inset-0 bg-slate-800 pointer-events-none"
                        />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'DEPLOYMENT' && (
            <motion.div
              key="deployment"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-[3rem] shadow-2xl border-2 border-premium-black relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-premium-black" />
              
              <div className="flex items-center space-x-4 mb-8">
                <div className="bg-premium-black p-3 rounded-2xl">
                  <Rocket className="text-white w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Security Protocol</div>
                  <h2 className="text-3xl font-display font-bold text-premium-black tracking-tight">Deployment Synthesis</h2>
                </div>
              </div>
              
              <p className="text-slate-500 mb-10 leading-relaxed max-w-md">
                To finalize the session and enable synchronized analytics, provide the integration metadata below.
              </p>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="flex items-center text-[10px] font-black text-premium-black uppercase tracking-[0.2em] ml-1">
                    <ShieldCheck className="w-3.5 h-3.5 mr-2 text-premium-accent" />
                    Integration Access Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter secure platform key..."
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-premium-accent/20 outline-none transition-all placeholder:text-slate-300"
                    value={adsClientId}
                    onChange={(e) => setAdsClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center text-[10px] font-black text-premium-black uppercase tracking-[0.2em] ml-1">
                    <Coins className="w-3.5 h-3.5 mr-2 text-premium-accent" />
                    Transaction Endpoint
                  </label>
                  <input
                    type="text"
                    placeholder="Enter wallet or destination address..."
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-premium-accent/20 outline-none transition-all placeholder:text-slate-300"
                    value={cryptoAddress}
                    onChange={(e) => setCryptoAddress(e.target.value)}
                  />
                   <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide ml-1 opacity-60">Verified via environment layer</p>
                </div>

                <button
                  onClick={finalizeDeployment}
                  className="w-full bg-premium-black hover:bg-slate-800 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98]"
                >
                  Confirm & Synchronize
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'COMPLETE' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 text-center w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-premium-accent via-blue-400 to-green-400" />
              
              <div className="mb-10 flex justify-center">
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1, rotate: 360 }} 
                  className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl shadow-green-100"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </motion.div>
              </div>
              
              <h2 className="text-4xl font-display font-black mb-3 text-premium-black tracking-tighter">Success Manifested</h2>
              <p className="text-slate-500 mb-12 max-w-md mx-auto leading-relaxed">
                Your professional profile has been reconstructed with elite-tier semantics. Export your assets below.
              </p>

              {/* Tabs */}
              <div className="flex p-1.5 bg-slate-100/50 rounded-2xl mb-10 max-w-xs mx-auto">
                <button
                  onClick={() => setActiveTab('resume')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
                    activeTab === 'resume' ? "bg-white text-premium-black shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Optimizer Resume
                </button>
                <button
                  onClick={() => setActiveTab('cover-letter')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
                    activeTab === 'cover-letter' ? "bg-white text-premium-black shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Cover Letter
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {activeTab === 'resume' ? (
                  <>
                    <button
                      onClick={downloadPdf}
                      disabled={!!isDownloading}
                      className="flex items-center justify-center space-x-3 bg-premium-black hover:bg-slate-800 text-white py-5 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-xl shadow-slate-100"
                    >
                      {isDownloading === 'pdf' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileDown className="w-5 h-5 opacity-40" />
                      )}
                      <span>Export as PDF</span>
                    </button>
                    <button
                      onClick={downloadWord}
                      disabled={!!isDownloading}
                      className="flex items-center justify-center space-x-3 bg-slate-100 hover:bg-slate-200 text-premium-black py-5 rounded-2xl font-bold transition-all disabled:opacity-50"
                    >
                      {isDownloading === 'word' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 opacity-40" />
                      )}
                      <span>Export as Word</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={downloadClWord}
                    disabled={!!isDownloading}
                    className="col-span-2 flex items-center justify-center space-x-3 bg-premium-black hover:bg-slate-800 text-white py-5 rounded-2xl font-bold transition-all disabled:opacity-50 shadow-xl shadow-slate-100"
                  >
                    {isDownloading === 'cl-word' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileDown className="w-5 h-5 opacity-40" />
                    )}
                    <span>Direct Export to Word</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-50/50 p-8 rounded-3xl text-left border border-slate-100 mb-12 overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {activeTab === 'resume' ? "MASTER RESUME OUTPUT" : "TAILORED LETTER OUTPUT"}
                  </div>
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                </div>
                
                {activeTab === 'resume' ? (
                  <div 
                    ref={finalCvRef}
                    className="markdown-body max-h-[600px] overflow-y-auto pr-4 bg-white p-10 rounded-2xl border border-white shadow-sm scrollbar-thin scrollbar-thumb-slate-100"
                  >
                    <ReactMarkdown>{stageOutputs[5]}</ReactMarkdown>
                  </div>
                ) : (
                  <div 
                    ref={finalClRef}
                    className="markdown-body max-h-[600px] overflow-y-auto pr-4 bg-white p-10 rounded-2xl border border-white shadow-sm scrollbar-thin scrollbar-thumb-slate-100"
                  >
                    {coverLetter ? (
                      <ReactMarkdown>{coverLetter}</ReactMarkdown>
                    ) : (
                      <div className="py-20 text-center text-slate-300">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 opacity-50" />
                        <p className="font-medium">Finalizing synthesis...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => window.location.reload()}
                className="group flex items-center mx-auto text-slate-400 hover:text-premium-black font-bold text-xs uppercase tracking-widest transition-all"
              >
                <Rocket className="w-4 h-4 mr-2 group-hover:-translate-y-1 transition-transform" />
                Start New Deployment Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {currentPage === 'HOME' && phase === 'INPUT' && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-24 space-y-20 mb-20"
          >
            {/* Strategy Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                  <Star className="text-blue-500 w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-premium-black mb-3 italic">ATS Precision</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Our neural engine reverse-engineers job descriptions to ensure your profile scores in the top 1% of Applicant Tracking Systems.
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6">
                  <HelpCircle className="text-purple-500 w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-premium-black mb-3 italic">Market Alignment</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  We don't just fix grammar; we align your experience with current market demands and recruiter-specific semantic triggers.
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen className="text-green-500 w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-premium-black mb-3 italic">Career Narrative</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Transform fragmented bullet points into a cohesive professional story that proves your value before the first interview.
                </p>
              </div>
            </div>

            {/* How it Works Section - High Text Content for AdSense */}
            <div className="bg-slate-900 text-white p-12 md:p-20 rounded-[3rem] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-premium-accent/20 blur-[100px] -mr-32 -mt-32" />
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-4xl font-display font-bold mb-8 tracking-tight">The 6-Stage Optimization Protocol</h2>
                <div className="space-y-6 text-slate-400 text-base leading-relaxed">
                  <p>
                    CareerFlow uses a sophisticated multi-stage approach to resume refinement. Unlike simple AI prompts, our system decomposes your professional identity and reconstructs it through the lens of a specific career goal.
                  </p>
                  <ul className="space-y-4 list-none p-0">
                    <li className="flex items-start">
                      <span className="text-premium-accent font-bold mr-4">01</span>
                      <span>Strategic Tailoring: We identify core competencies within the JD that your current CV might be underselling.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-premium-accent font-bold mr-4">02</span>
                      <span>Action-Result Synthesis: Every bullet point is re-engineered to emphasize measurable impact over passive duties.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-premium-accent font-bold mr-4">03</span>
                      <span>Executive Branding: We craft a summary that positions you not just as a candidate, but as a solution.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </>
        ) : null}

        {currentPage === 'ABOUT' && (
          <StaticPage 
            title="About CareerFlow" 
            icon={<Info className="w-6 h-6 text-blue-500" />}
            content={AboutContent}
            onBack={() => setCurrentPage('HOME')}
          />
        )}

        {currentPage === 'PRIVACY' && (
          <StaticPage 
            title="Privacy Guard" 
            icon={<Shield className="w-6 h-6 text-green-500" />}
            content={PrivacyContent}
            onBack={() => setCurrentPage('HOME')}
          />
        )}

        {currentPage === 'TERMS' && (
          <StaticPage 
            title="Operating Terms" 
            icon={<FileTextIcon className="w-6 h-6 text-slate-500" />}
            content={TermsContent}
            onBack={() => setCurrentPage('HOME')}
          />
        )}

        {/* Footer */}
        <footer className="mt-20 text-center pb-20">
          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-8">
            <button onClick={() => setCurrentPage('ABOUT')} className="hover:text-premium-black transition-colors pointer-events-auto">About Us</button>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <button onClick={() => setCurrentPage('PRIVACY')} className="hover:text-premium-black transition-colors pointer-events-auto">Privacy</button>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <button onClick={() => setCurrentPage('TERMS')} className="hover:text-premium-black transition-colors pointer-events-auto">Terms of Service</button>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <span>Optimized by Gemini</span>
          </div>
          <p className="text-[10px] text-slate-300 tracking-widest uppercase italic font-medium">
            © 2026 CoreFlow Intelligence Systems • Architecting Professional Success
          </p>
        </footer>
      </div>
    </div>
  );
}
