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
import { optimizeResumeStage, generateCoverLetter, type OptimizationStage } from './services/geminiService';
import { cn } from './lib/utils';
import { extractTextFromPdf } from './lib/pdfUtils';

type Phase = 'INPUT' | 'OPTIMIZING' | 'DEPLOYMENT' | 'COMPLETE';

export default function App() {
  const [phase, setPhase] = useState<Phase>('INPUT');
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
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center py-12 px-4 selection:bg-neutral-200">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center bg-black text-white px-3 py-1 rounded-full text-xs font-medium mb-4 tracking-wider uppercase"
          >
            <Sparkles className="w-3 h-3 mr-2" />
            AI-Powered Transformation
          </motion.div>
          <h1 className="text-5xl font-serif italic font-black text-neutral-900 tracking-tighter mb-4">
            CareerFlow <span className="font-sans not-italic text-neutral-400 font-light">Optimizer Pro</span>
          </h1>
          <p className="text-neutral-500 max-w-xl mx-auto">
            The 6-stage optimization engine designed to elevate your professional narrative to consulting standards.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {phase === 'INPUT' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-2xl shadow-xl shadow-neutral-200 border border-neutral-100"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center text-neutral-900 font-semibold">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Job Description
                  </div>
                  <textarea
                    placeholder="Paste the target Job Description here..."
                    className="w-full h-80 p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none text-sm leading-relaxed"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center text-neutral-900 font-semibold">
                    <FileText className="w-4 h-4 mr-2" />
                    Current Resume (PDF or TXT)
                  </div>
                  <label 
                    className={cn(
                      "w-full h-80 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all gap-4 px-6 text-center",
                      cvText ? "bg-green-50/50 border-green-200" : "bg-neutral-50 border-neutral-200 hover:border-black hover:bg-neutral-100/50",
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
                      <Loader2 className="w-10 h-10 text-neutral-400 animate-spin" />
                    ) : cvText ? (
                      <>
                        <div className="bg-green-100 p-4 rounded-full">
                          <FileCheck className="w-8 h-8 text-green-600" />
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900">{cvFileName}</p>
                          <p className="text-sm text-green-600">File uploaded and parsed successfully</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setCvText('');
                            setCvFileName(null);
                          }}
                          className="text-xs text-neutral-400 hover:text-red-500 underline"
                        >
                          Change File
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-neutral-100 p-4 rounded-full">
                          <FileUp className="w-8 h-8 text-neutral-400" />
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900">Click to upload or drag and drop</p>
                          <p className="text-sm text-neutral-400 mt-1">Supports PDF and Text files</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>
              </div>
              
              {error && (
                <div className="mt-6 flex items-center bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              <button
                onClick={startOptimization}
                className="w-full mt-8 bg-black hover:bg-neutral-800 text-white py-4 rounded-xl font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center"
              >
                Start Optimization Engine
                <ChevronRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {phase === 'OPTIMIZING' && (
            <motion.div
              key="optimizing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center"
            >
              {renderProgress()}

              <div className="w-full bg-white p-8 rounded-2xl shadow-xl border border-neutral-100 min-h-[500px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-6 border-b border-neutral-100 pb-4">
                  <div>
                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Stage {currentStage}</span>
                    <h2 className="text-xl font-bold text-neutral-900">
                      {currentStage === 1 && "Initial Strategic Re-write"}
                      {currentStage === 2 && "Work Experience Alignment"}
                      {currentStage === 3 && "ATS Keyword Infusion"}
                      {currentStage === 4 && "Gap Analysis & Reframing"}
                      {currentStage === 5 && "Executive Summary Crafting"}
                      {currentStage === 6 && "Hiring Manager Review"}
                    </h2>
                  </div>
                  {isProcessing && (
                    <div className="flex items-center text-black font-semibold animate-pulse">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Optimizing...
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 max-h-[600px]">
                  {stageOutputs[currentStage - 1] ? (
                    <div className="markdown-body">
                      <ReactMarkdown>{stageOutputs[currentStage - 1]}</ReactMarkdown>
                    </div>
                  ) : !isProcessing ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                      {error ? (
                        <div className="flex flex-col items-center p-8 text-center bg-red-50 rounded-xl border border-red-100 max-w-md">
                          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                          <h3 className="text-red-900 font-bold mb-2 uppercase text-xs tracking-widest">Optimization Error</h3>
                          <p className="text-red-600 text-sm mb-6 leading-relaxed">
                            {error}
                          </p>
                          <button 
                            onClick={() => runStage(currentStage)}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 flex items-center"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Retry Stage {currentStage}
                          </button>
                        </div>
                      ) : (
                        <>
                          <Loader2 className="w-12 h-12 animate-spin" />
                          <p>Engine warm-up in progress...</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
                      <Loader2 className="w-12 h-12 animate-spin" />
                      <p className="animate-pulse">Analyzing and refining Stage {currentStage}...</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex space-x-4">
                  <button
                    onClick={() => setPhase('INPUT')}
                    className="flex items-center bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-6 py-3 rounded-xl font-semibold transition-all relative z-20"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Reset
                  </button>
                  <button
                    onClick={approveStage}
                    disabled={!stageOutputs[currentStage - 1] || isProcessing}
                    className="flex-1 bg-black hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center">
                      {currentStage === 6 ? "Finalizing..." : "Next Stage (Auto-proceeding...)"}
                      <ChevronRight className="ml-2 w-5 h-5" />
                    </span>
                    {!isProcessing && stageOutputs[currentStage - 1] && (
                      <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "0%" }}
                        transition={{ duration: currentStage === 6 ? 4 : 3, ease: "linear" }}
                        className="absolute inset-0 bg-neutral-700 pointer-events-none"
                      />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'DEPLOYMENT' && (
            <motion.div
              key="deployment"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-2xl shadow-2xl border-2 border-black"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-black p-2 rounded-lg">
                  <Rocket className="text-white w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black italic font-serif">Developer Configuration Required</h2>
              </div>
              
              <p className="text-neutral-500 mb-8 leading-relaxed">
                To finalize the deployment of this app instance and enable revenue integration, please provide the following secure metadata.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="flex items-center text-sm font-bold text-neutral-800 mb-2 uppercase tracking-tighter">
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Google Ads Client ID & Secret
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Client ID or Secret..."
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                    value={adsClientId}
                    onChange={(e) => setAdsClientId(e.target.value)}
                  />
                  <p className="text-[10px] text-neutral-400 mt-1 uppercase">Stored in environment variables</p>
                </div>

                <div>
                  <label className="flex items-center text-sm font-bold text-neutral-800 mb-2 uppercase tracking-tighter">
                    <Coins className="w-4 h-4 mr-2" />
                    Crypto Donation Address (BTC/ETH/SOL)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter wallet address..."
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-black outline-none"
                    value={cryptoAddress}
                    onChange={(e) => setCryptoAddress(e.target.value)}
                  />
                   <p className="text-[10px] text-neutral-400 mt-1 uppercase">Used for direct developer tips</p>
                </div>

                <button
                  onClick={finalizeDeployment}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                >
                  Finalize & Deploy
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'COMPLETE' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center bg-white p-8 rounded-2xl shadow-xl w-full"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2 italic font-serif text-neutral-900">Optimization Complete</h2>
              <p className="text-neutral-500 mb-8 max-w-sm mx-auto">
                Your professional narrative and cover letter have been fully transformed and are ready for high-impact applications.
              </p>

              {/* Tabs */}
              <div className="flex border-b border-neutral-100 mb-6">
                <button
                  onClick={() => setActiveTab('resume')}
                  className={cn(
                    "flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                    activeTab === 'resume' ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  Optimized Resume
                </button>
                <button
                  onClick={() => setActiveTab('cover-letter')}
                  className={cn(
                    "flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                    activeTab === 'cover-letter' ? "border-black text-black" : "border-transparent text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  Cover Letter
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {activeTab === 'resume' ? (
                  <>
                    <button
                      onClick={downloadPdf}
                      disabled={!!isDownloading}
                      className="flex items-center justify-center space-x-3 bg-neutral-900 hover:bg-neutral-800 text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                      {isDownloading === 'pdf' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileDown className="w-5 h-5" />
                      )}
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={downloadWord}
                      disabled={!!isDownloading}
                      className="flex items-center justify-center space-x-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 py-4 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                      {isDownloading === 'word' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                      <span>Download Word</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={downloadClWord}
                    disabled={!!isDownloading}
                    className="col-span-2 flex items-center justify-center space-x-3 bg-neutral-900 hover:bg-neutral-800 text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {isDownloading === 'cl-word' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileDown className="w-5 h-5" />
                    )}
                    <span>Download Cover Letter (Word)</span>
                  </button>
                )}
              </div>

              <div className="bg-neutral-50 p-6 rounded-xl text-left border border-neutral-200 mb-8 overflow-hidden">
                <div className="text-[10px] font-bold text-neutral-400 uppercase mb-4 tracking-widest border-b border-neutral-100 pb-2">
                  {activeTab === 'resume' ? "Final Optimized Document" : "Tailored Cover Letter"}
                </div>
                
                {activeTab === 'resume' ? (
                  <div 
                    ref={finalCvRef}
                    className="markdown-body max-h-[500px] overflow-y-auto pr-2 bg-white p-6 rounded-lg border border-neutral-100 shadow-sm"
                  >
                    <ReactMarkdown>{stageOutputs[5]}</ReactMarkdown>
                  </div>
                ) : (
                  <div 
                    ref={finalClRef}
                    className="markdown-body max-h-[500px] overflow-y-auto pr-2 bg-white p-6 rounded-lg border border-neutral-100 shadow-sm"
                  >
                    {coverLetter ? (
                      <ReactMarkdown>{coverLetter}</ReactMarkdown>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Generating cover letter...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => window.location.reload()}
                className="text-neutral-400 hover:text-black font-semibold text-sm underline underline-offset-4"
              >
                Start New Optimization Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-12 text-center text-[10px] text-neutral-400 uppercase tracking-[0.2em] pb-12">
          Engine Version 2.0.1 • Senior Strategist Protocol Active
        </footer>
      </div>
    </div>
  );
}
