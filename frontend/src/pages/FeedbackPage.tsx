import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type FeedbackRating = 'VERY_DISSATISFIED' | 'DISSATISFIED' | 'NEUTRAL' | 'SATISFIED' | 'VERY_SATISFIED';

interface TicketInfo {
  ticketNumber: number;
  ticketSubject: string;
  hasSubmitted: boolean;
  rating?: FeedbackRating;
}

const ratingEmojis: Record<FeedbackRating, { emoji: string; label: string; color: string }> = {
  VERY_DISSATISFIED: { emoji: '😞', label: 'Very Dissatisfied', color: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30' },
  DISSATISFIED: { emoji: '😕', label: 'Dissatisfied', color: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/30' },
  NEUTRAL: { emoji: '😐', label: 'Neutral', color: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600' },
  SATISFIED: { emoji: '😊', label: 'Satisfied', color: 'bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30' },
  VERY_SATISFIED: { emoji: '🤩', label: 'Very Satisfied', color: 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30' }
};

export default function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const preSelectedRating = searchParams.get('rating') as FeedbackRating | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(preSelectedRating);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid feedback link');
      setLoading(false);
      return;
    }

    // Verify token and get ticket info
    axios.get(`${API_URL}/api/feedback/verify/${token}`)
      .then(response => {
        setTicketInfo(response.data);
        if (response.data.hasSubmitted) {
          setSubmitted(true);
          setSelectedRating(response.data.rating);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load feedback form');
        setLoading(false);
      });
  }, [token]);

  // Auto-submit if rating was pre-selected from email link
  useEffect(() => {
    if (ticketInfo && !ticketInfo.hasSubmitted && preSelectedRating && !submitting && !submitted) {
      handleSubmit();
    }
  }, [ticketInfo, preSelectedRating]);

  const handleSubmit = async () => {
    if (!selectedRating || !token) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/feedback`, {
        token,
        rating: selectedRating,
        userComment: comment || undefined
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading feedback form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">
            {selectedRating && ratingEmojis[selectedRating].emoji}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your feedback has been submitted successfully.
          </p>
          {ticketInfo && (
            <div className="text-sm text-gray-500 dark:text-gray-500">
              Ticket #{ticketInfo.ticketNumber}: {ticketInfo.ticketSubject}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          How was your support experience?
        </h1>

        {ticketInfo && (
          <div className="text-center mb-6">
            <p className="text-gray-600 dark:text-gray-400">
              Ticket #{ticketInfo.ticketNumber}: {ticketInfo.ticketSubject}
            </p>
          </div>
        )}

        <div className="mb-8">
          <p className="text-gray-700 dark:text-gray-300 mb-6 text-center">
            Please rate your satisfaction with the support you received:
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(Object.keys(ratingEmojis) as FeedbackRating[]).map((rating) => {
              const { emoji, label, color } = ratingEmojis[rating];
              const isSelected = selectedRating === rating;

              return (
                <button
                  key={rating}
                  onClick={() => setSelectedRating(rating)}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${isSelected
                      ? 'border-primary scale-105'
                      : 'border-gray-200 dark:border-gray-700'
                    }
                    ${color}
                  `}
                >
                  <div className="text-5xl mb-2">{emoji}</div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Comments (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more about your experience..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selectedRating || submitting}
          className={`
            w-full py-3 px-6 rounded-lg font-medium text-white
            transition-colors
            ${!selectedRating || submitting
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-dark cursor-pointer'
            }
          `}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
}
