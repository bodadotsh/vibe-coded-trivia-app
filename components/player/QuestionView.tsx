'use client';

import { CountdownTimer } from '@/components/shared/CountdownTimer';
import type { ClientQuestion } from '@/lib/types';

const OPTION_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
const OPTION_SHAPES = ['\u25B2', '\u25C6', '\u25CF', '\u25A0'];

interface QuestionViewProps {
  question: ClientQuestion;
  roundStartedAt: string | number;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
  disabled: boolean;
  onExpired?: () => void;
}

export function QuestionView({
  question,
  roundStartedAt,
  selectedOptionId,
  onSelect,
  disabled,
  onExpired,
}: QuestionViewProps) {
  const hasAnswered = selectedOptionId !== null;

  return (
    <div className="flex min-h-[80vh] flex-col px-4 py-6">
      {/* Timer */}
      <div className="flex justify-center mb-6">
        <CountdownTimer
          roundStartedAt={roundStartedAt}
          timeLimit={question.timeLimit}
          size="lg"
          onExpired={onExpired}
        />
      </div>

      {/* Question */}
      <div className="mb-8 text-center">
        <p className="text-xs text-muted mb-2">Question {question.questionIndex + 1}</p>
        <h2 className="text-xl sm:text-2xl font-bold">{question.text}</h2>
      </div>

      {/* Options */}
      {hasAnswered ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 animate-slide-up">
            <div className="text-5xl">&#10003;</div>
            <p className="text-xl font-bold">Answer submitted!</p>
            <p className="text-muted">Waiting for the round to end...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 flex-1 max-h-[50vh]">
          {question.options.map((option, i) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              disabled={disabled || hasAnswered}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: OPTION_COLORS[i] }}
            >
              <span className="text-3xl opacity-60">{OPTION_SHAPES[i]}</span>
              <span className="text-base sm:text-lg leading-tight">{option.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
