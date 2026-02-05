import { useQuery } from '@tanstack/react-query';
import { feedbackApi } from '../lib/api';

const ratingEmojis: Record<string, { emoji: string; label: string }> = {
  VERY_DISSATISFIED: { emoji: '😞', label: 'Very Dissatisfied' },
  DISSATISFIED: { emoji: '😕', label: 'Dissatisfied' },
  NEUTRAL: { emoji: '😐', label: 'Neutral' },
  SATISFIED: { emoji: '😊', label: 'Satisfied' },
  VERY_SATISFIED: { emoji: '🤩', label: 'Very Satisfied' }
};

export default function FeedbackStatsWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feedbackStats'],
    queryFn: async () => {
      const response = await feedbackApi.getAll();
      return response.data;
    },
    refetchInterval: 60000 // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Customer Satisfaction
        </h3>
        <div className="animate-pulse">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Customer Satisfaction
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Failed to load feedback data
        </p>
      </div>
    );
  }

  const analytics = data?.analytics;
  if (!analytics) return null;

  const satisfactionPercentage = analytics.satisfactionPercentage || 0;
  const totalFeedback = analytics.totalFeedback || 0;
  const ratingCounts = analytics.ratingCounts || {};

  // Calculate percentage of total for each rating
  const ratingPercentages: Record<string, number> = {};
  if (totalFeedback > 0) {
    Object.keys(ratingCounts).forEach(rating => {
      ratingPercentages[rating] = Math.round((ratingCounts[rating] / totalFeedback) * 100);
    });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Customer Satisfaction
      </h3>

      {totalFeedback === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No feedback collected yet
        </p>
      ) : (
        <div className="space-y-4">
          {/* Satisfaction Percentage */}
          <div className="text-center">
            <div className="text-5xl font-bold text-primary mb-2">
              {satisfactionPercentage}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Customer Satisfaction
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Based on {totalFeedback} {totalFeedback === 1 ? 'response' : 'responses'}
            </p>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            {Object.entries(ratingEmojis).map(([rating, info]) => {
              const count = ratingCounts[rating] || 0;
              const percentage = ratingPercentages[rating] || 0;

              if (count === 0) return null;

              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-2xl">{info.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{info.label}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
