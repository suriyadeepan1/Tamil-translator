import React from 'react';
import { ApiError } from '../types';

interface ErrorDisplayProps {
  error: ApiError;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-red-700 bg-red-50 p-6 rounded-lg border border-red-200">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <strong className="text-lg font-semibold">{error.title}</strong>
      <p className="mt-2 mb-6 text-red-600 max-w-md">{error.message}</p>
      <div className="flex items-center space-x-4">
        {error.isRetryable && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            Retry
          </button>
        )}
        <a 
          href="mailto:support@example.com?subject=Tamil Translator Error"
          className="text-sm font-medium text-slate-600 hover:text-slate-800 hover:underline"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
};

export default ErrorDisplay;
