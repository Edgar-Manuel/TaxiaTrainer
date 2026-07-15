"use client";

import { AnimatePresence, motion } from "framer-motion";
import { XIcon, TimerIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EXAM } from "@/lib/config";
import { formatClock, formatDistance } from "@/lib/utils";
import { sounds } from "@/lib/sound";
import type { CityData } from "@/domains/cities/types";
import { generateExam, generateSession } from "@/domains/game/generator";
import { checkAchievements } from "@/domains/gamification/achievements";
import { isDue } from "@/domains/srs/sm2";
import { buildSummary, useGame } from "@/stores/game-store";
import { useProgress, type RecordedSession } from "@/stores/progress-store";
import type { Question, QuestionResult, QuestionType } from "@/types/game";
import { ChoiceQuestionView } from "./ChoiceQuestionView";
import { MapClickQuestionView } from "./MapClickQuestionView";
import { MemoryQuestionView } from "./MemoryQuestionView";
import { RouteQuestionView } from "./RouteQuestionView";
import { SessionSummaryView } from "./SessionSummaryView";

const CHOICE_TYPES = new Set([
  "name_street",
  "guess_neighborhood",
  "crossing_street",
  "nearby_street",
  "parallel_street",
  "flows_into",
]);

interface Props {
  city: CityData;
  mode: QuestionType;
}

export function GameSession({ city, mode }: Props) {
  const game = useGame();
  const progress = useProgress();
  const [finishedSession, setFinishedSession] = useState<RecordedSession | null>(null);
  const [examPassed, setExamPassed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const startedRef = useRef(false);

  const isExam = mode === "official_exam";

  const startSession = useMemo(
    () => () => {
      const weakOrDue = new Set(
        Object.entries(progress.mastery)
          .filter(([, srs]) => isDue(srs) || srs.mastery < 40)
          .map(([key]) => key.split(":")[1]),
      );
      const ctx = { city, preferredTargets: weakOrDue };
      const questions: Question[] = isExam
        ? generateExam(ctx, EXAM.questionCount)
        : generateSession(mode, ctx, 8);
      game.start(mode, city.city.id, questions, isExam ? EXAM.timeLimitS : undefined);
      setFinishedSession(null);
      setTimeLeft(isExam ? EXAM.timeLimitS : null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city, mode],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exam countdown.
  useEffect(() => {
    if (!isExam || game.phase === "finished" || game.phase === "idle") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) {
          clearInterval(interval);
          game.finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExam, game.phase === "finished", game.phase === "idle"]);

  // Persist results when the session ends.
  useEffect(() => {
    if (game.phase !== "finished" || !game.mode || finishedSession) return;
    const summary = buildSummary({
      mode: game.mode,
      results: game.results,
      startedAt: game.startedAt,
    });
    const session = progress.completeSession(city.city.id, summary);
    const scoreRatio = summary.maxScore > 0 ? summary.score / summary.maxScore : 0;
    if (isExam) setExamPassed(scoreRatio >= EXAM.passPct);
    checkAchievements({
      progress: useProgress.getState(),
      justFinished: { summary, isExam, passed: scoreRatio >= EXAM.passPct },
    });
    setFinishedSession(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  const question = game.questions[game.currentIndex];
  const lastResult = game.results[game.results.length - 1] ?? null;
  const feedback = game.phase === "feedback" ? lastResult : null;

  const handleAnswer = (result: QuestionResult) => {
    if (result.correct) sounds.correct();
    else sounds.wrong();
    progress.recordAnswer(city.city.id, result);
    game.submitResult(result);
  };

  if (game.phase === "finished" && finishedSession && game.mode) {
    const summary = buildSummary({
      mode: game.mode,
      results: game.results,
      startedAt: game.startedAt,
    });
    return (
      <SessionSummaryView
        summary={{ ...summary, xpEarned: finishedSession.xpEarned }}
        session={finishedSession}
        isExam={isExam}
        passed={examPassed}
        onRetry={() => {
          game.reset();
          startSession();
        }}
      />
    );
  }

  if (!question) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-5xl">🗺️</div>
        <p className="font-bold">
          No hay suficientes datos en esta ciudad para generar este modo.
        </p>
        <Button asChild>
          <Link href="/play">Volver a los modos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: progress + timer + quit */}
      <div className="flex items-center gap-3 border-b-2 bg-card px-4 py-3">
        <Button variant="ghost" size="icon" asChild aria-label="Salir">
          <Link href="/play">
            <XIcon />
          </Link>
        </Button>
        <Progress
          value={((game.currentIndex + (feedback ? 1 : 0)) / game.questions.length) * 100}
          className="flex-1"
        />
        {timeLeft !== null && (
          <div
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-sm font-black ${
              timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-muted"
            }`}
          >
            <TimerIcon className="size-4" />
            {formatClock(timeLeft)}
          </div>
        )}
        <span className="text-sm font-bold text-muted-foreground">
          {game.currentIndex + 1}/{game.questions.length}
        </span>
      </div>

      {/* Prompt */}
      <div className="border-b-2 bg-card px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.h1
            key={question.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="text-lg font-extrabold"
          >
            {question.prompt}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Question body */}
      <div className="relative min-h-0 flex-1">
        <QuestionBody
          key={question.id}
          city={city}
          question={question}
          questionStartedAt={game.questionStartedAt}
          feedback={feedback}
          onAnswer={handleAnswer}
        />

        {/* Feedback banner */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className={`absolute inset-x-0 bottom-0 z-10 border-t-4 p-4 ${
                feedback.correct
                  ? "border-primary bg-accent"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
                <div>
                  <div
                    className={`text-lg font-black ${
                      feedback.correct ? "text-accent-foreground" : "text-destructive"
                    }`}
                  >
                    {feedback.correct ? "¡Correcto! ✨" : "Incorrecto"}
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground">
                    {feedback.distanceM !== undefined &&
                      `A ${formatDistance(feedback.distanceM)} del objetivo. `}
                    {typeof feedback.score === "number" &&
                      feedback.maxScore === 1 &&
                      feedback.score > 0 &&
                      feedback.score < 1 &&
                      `Puntuación parcial: ${Math.round(feedback.score * 100)}%. `}
                    {feedback.question.explanation}
                  </div>
                </div>
                <Button
                  variant={feedback.correct ? "default" : "destructive"}
                  onClick={game.next}
                  autoFocus
                >
                  Continuar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionBody(props: {
  city: CityData;
  question: Question;
  questionStartedAt: number;
  feedback: QuestionResult | null;
  onAnswer: (result: QuestionResult) => void;
}) {
  const { question } = props;
  if (CHOICE_TYPES.has(question.type)) return <ChoiceQuestionView {...props} />;
  if (question.type === "visual_memory") return <MemoryQuestionView {...props} />;
  if (question.type === "complete_route" || question.type === "fastest_route") {
    return <RouteQuestionView {...props} />;
  }
  return <MapClickQuestionView {...props} />;
}
