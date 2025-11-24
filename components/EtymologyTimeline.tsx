import React from 'react';
import { EtymologyStep } from '../types';

interface EtymologyTimelineProps {
  steps: EtymologyStep[];
}

const EtymologyTimeline: React.FC<EtymologyTimelineProps> = ({ steps }) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }
  
  return (
    <div className="relative pl-4 border-l-2 border-indigo-200/70 space-y-6">
      {steps.map((step, index) => (
        <div key={index} className="relative">
          <div className="absolute w-3 h-3 bg-indigo-600 rounded-full -left-[23px] top-1.5 border-2 border-white shadow"></div>
          <div className="ml-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{step.era} &bull; <span className="font-bold text-indigo-700">{step.language}</span></p>
            <p className="mt-1 text-sm text-slate-600">{step.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EtymologyTimeline;
