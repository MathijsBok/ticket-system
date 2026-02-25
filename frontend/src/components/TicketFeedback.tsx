import { format } from 'date-fns';

interface TicketFeedbackProps {
  feedback?: {
    rating: 'VERY_DISSATISFIED' | 'DISSATISFIED' | 'NEUTRAL' | 'SATISFIED' | 'VERY_SATISFIED';
    userComment?: string | null;
    submittedAt: string;
  } | null;
}

const ratingInfo: Record<string, { emoji: string; label: string; color: string; bgColor: string }> = {
  VERY_DISSATISFIED: {
    emoji: '😞',
    label: 'Very Dissatisfied',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  },
  DISSATISFIED: {
    emoji: '😕',
    label: 'Dissatisfied',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  },
  NEUTRAL: {
    emoji: '😐',
    label: 'Neutral',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  },
  SATISFIED: {
    emoji: '😊',
    label: 'Satisfied',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
  },
  VERY_SATISFIED: {
    emoji: '🤩',
    label: 'Very Satisfied',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
  }
};

export default function TicketFeedback({ feedback }: TicketFeedbackProps) {
  if (!feedback) return null;

  const info = ratingInfo[feedback.rating];

  return (
    <div className={`rounded-lg border-2 p-4 ${info.bgColor}`}>
      <div className="flex items-start gap-3">
        <div className="text-5xl">{info.emoji}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`text-lg font-semibold ${info.color}`}>
              Customer Feedback: {info.label}
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Submitted {format(new Date(feedback.submittedAt), 'MMM d, yyyy \'at\' h:mm a')}
          </p>
          {feedback.userComment && (
            <div className="mt-3 p-3 bg-white/50 dark:bg-gray-900/20 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Comments:
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {feedback.userComment}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
