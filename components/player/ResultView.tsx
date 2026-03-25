'use client';

interface ResultViewProps {
  isCorrect: boolean;
  score: number;
  correctOptionText: string;
  selectedOptionText: string;
  answered: boolean;
}

export function ResultView({ isCorrect, score, correctOptionText, selectedOptionText, answered }: ResultViewProps) {
  if (!answered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-slide-up">
        <div className="text-6xl">&#128564;</div>
        <h2 className="text-2xl font-bold">Time&apos;s up!</h2>
        <p className="text-muted">You didn&apos;t submit an answer</p>
        <p className="text-sm text-muted">
          Correct answer: <span className="text-answer-green font-medium">{correctOptionText}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-slide-up">
      {isCorrect ? (
        <>
          <div className="text-6xl">&#127881;</div>
          <h2 className="text-2xl font-bold text-answer-green">Correct!</h2>
          <div className="animate-score-pop">
            <span className="text-4xl font-bold text-accent">+{Math.round(score)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="text-6xl">&#10060;</div>
          <h2 className="text-2xl font-bold text-answer-red">Incorrect</h2>
          <p className="text-muted">
            You answered: <span className="font-medium">{selectedOptionText}</span>
          </p>
          <p className="text-sm text-muted">
            Correct answer: <span className="text-answer-green font-medium">{correctOptionText}</span>
          </p>
        </>
      )}
    </div>
  );
}
