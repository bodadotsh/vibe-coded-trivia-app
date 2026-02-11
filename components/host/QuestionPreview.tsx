'use client';

import type { ClientQuestion } from '@/lib/types';

const OPTION_COLORS = ['var(--answer-red)', 'var(--answer-blue)', 'var(--answer-yellow)', 'var(--answer-green)'];
const OPTION_SHAPES = ['\u25B2', '\u25C6', '\u25CF', '\u25A0']; // triangle, diamond, circle, square

interface QuestionPreviewProps {
  question: ClientQuestion | null;
  correctOptionId?: string;
  questionIndex: number;
  totalQuestions: number;
}

export function QuestionPreview({ question, correctOptionId, questionIndex, totalQuestions }: QuestionPreviewProps) {
  if (!question) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-6 text-center">
        <p className="text-muted">Waiting for next round...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        <span>{question.timeLimit}s time limit</span>
      </div>

      <h2 className="text-xl font-bold">{question.text}</h2>

      <div className="grid grid-cols-2 gap-2">
        {question.options.map((option, i) => {
          const isCorrect = correctOptionId === option.id;
          const borderStyle = correctOptionId ? (isCorrect ? 'ring-2 ring-answer-green' : 'opacity-50') : '';

          return (
            <div
              key={option.id}
              className={`flex items-center gap-2 rounded-lg p-3 ${borderStyle}`}
              style={{
                backgroundColor: `${OPTION_COLORS[i]}20`,
                borderLeft: `4px solid ${OPTION_COLORS[i]}`,
              }}
            >
              <span style={{ color: OPTION_COLORS[i] }} className="text-lg">
                {OPTION_SHAPES[i]}
              </span>
              <span className="text-sm font-medium">{option.text}</span>
              {isCorrect && <span className="ml-auto text-answer-green">&#10003;</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
