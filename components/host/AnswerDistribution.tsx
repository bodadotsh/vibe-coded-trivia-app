'use client';

import type { QuestionOption } from '@/lib/types';

const BAR_COLORS = ['var(--answer-red)', 'var(--answer-blue)', 'var(--answer-yellow)', 'var(--answer-green)'];
const OPTION_SHAPES = ['\u25B2', '\u25C6', '\u25CF', '\u25A0'];

interface AnswerDistributionProps {
  options: QuestionOption[];
  distribution: Record<string, number>;
  correctOptionId?: string;
  totalAnswers: number;
}

export function AnswerDistribution({ options, distribution, correctOptionId, totalAnswers }: AnswerDistributionProps) {
  const maxCount = Math.max(1, ...Object.values(distribution));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Answer Distribution</span>
        <span>
          {totalAnswers} answer{totalAnswers !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {options.map((option, i) => {
          const count = distribution[option.id] ?? 0;
          const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
          const barWidth = (count / maxCount) * 100;
          const isCorrect = correctOptionId === option.id;

          return (
            <div key={option.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span style={{ color: BAR_COLORS[i] }}>{OPTION_SHAPES[i]}</span>
                  <span className={isCorrect ? 'font-bold text-answer-green' : ''}>{option.text}</span>
                  {isCorrect && <span className="text-answer-green text-xs">&#10003; Correct</span>}
                </span>
                <span className="text-muted">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-card-border">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: BAR_COLORS[i],
                    opacity: isCorrect ? 1 : 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
