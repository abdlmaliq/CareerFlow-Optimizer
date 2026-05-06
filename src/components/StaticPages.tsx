import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Shield, FileText, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface StaticPageProps {
  title: string;
  onBack: () => void;
  content: string;
  icon: React.ReactNode;
}

export const StaticPage: React.FC<StaticPageProps> = ({ title, onBack, content, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl w-full"
    >
      <button
        onClick={onBack}
        className="flex items-center text-slate-400 hover:text-premium-black font-bold text-xs uppercase tracking-widest mb-10 transition-all group"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Optimizer
      </button>

      <div className="bg-white p-12 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center space-x-4 mb-10">
          <div className="bg-slate-100 p-4 rounded-2xl">
            {icon}
          </div>
          <h1 className="text-4xl font-display font-black text-premium-black tracking-tight">{title}</h1>
        </div>

        <div className="markdown-body prose prose-slate max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
};

export const PrivacyContent = `
# Privacy Policy
*Last Updated: May 6, 2026*

At CareerFlow, we take your privacy seriously. This policy explains how we handle your data.

### 1. Data Collection
We do not store your uploaded resumes or job descriptions on our servers. All processing is transient and used solely for the duration of your optimization session.

### 2. Analytics and Advertising
We use third-party tools like Google Analytics and Google AdSense to improve our service and display relevant content. These services may use cookies to track usage patterns.

### 3. AI Processing
Input data is processed via Google Gemini AI. By using this service, you agree to Google's AI terms. No personal data is used to train these models through our implementation.
`;

export const TermsContent = `
# Terms of Service
*Last Updated: May 6, 2026*

### 1. Acceptance of Terms
By accessing CareerFlow, you agree to abide by these terms.

### 2. Use of Service
CareerFlow provides AI-based resume optimization. We do not guarantee employment or specific results from the use of our generated documents.

### 3. Usage Limits
To ensure fair access, we limit optimization sessions to 5 per user per 24-hour period.

### 4. User Responsibility
You are responsible for the accuracy of any information you provide and the final content of the resumes you export.
`;

export const AboutContent = `
# About CareerFlow

### Our Mission
CareerFlow Optimizer is a tool created to help job seekers who possess the required skills for a role but are being hindered by a CV or Cover Letter that doesn't effectively showcase their potential. We believe that a great candidate shouldn't be held back by formatting or keyword matching.

### How It Works
Our platform is designed to be intuitive and transparent. It walks you through each step of the optimization process, showing exactly how your CV is being refined to match what recruiters are looking for in specific job descriptions. By bridge the gap between talent and presentation, we help you put your best foot forward.

### Our Vision
Our vision for CareerFlow is to help reduce the unemployment rate globally. We are dedicated to supporting those who are willing and capable of working but may not have the technical knowledge to draft a professional, modern CV or Cover Letter. We aim to democratize the job application process through intelligent, accessible technology.

### Get In Touch
Looking to collaborate or support this app in any way? You can always contact us at **careerflowoptimizer@gmail.com** and we will provide a prompt response.
`;
