"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { completeLesson, recordReadingProgress } from "@/app/(app)/course/actions";
import { ProgressBar } from "@/components/common/progress-bar";
import { Button } from "@/components/ui/button";
import { completionEligibility } from "@/lib/engines/completion";

/**
 * Reading progress and lesson completion.
 *
 * Only time the tab is **visible** counts, and it is flushed to the server in
 * bounded increments. Leaving a lesson open overnight therefore produces almost
 * no progress, which is the point — the platform is measuring reading, not
 * browser tabs.
 *
 * The button here is a convenience, not the rule. `completeLesson` re-checks
 * the stored scroll depth and dwell time server-side before accepting.
 */

/** How often accumulated active time is sent to the server. */
const FLUSH_INTERVAL_MS = 30_000;

export function ReadingProgress({
  lessonPath,
  durationMinutes,
  initialSeconds,
  initialScroll,
  alreadyComplete,
  nextHref,
}: {
  lessonPath: string;
  durationMinutes: number;
  initialSeconds: number;
  initialScroll: number;
  alreadyComplete: boolean;
  nextHref: string | null;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [scroll, setScroll] = useState(initialScroll);
  const [complete, setComplete] = useState(alreadyComplete);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Active time accumulated since the last flush. A ref rather than state so
  // ticking does not re-render the page every second.
  const unflushed = useRef(0);
  const latestScroll = useRef(initialScroll);

  const flush = useCallback(
    (final = false) => {
      const secondsDelta = Math.min(unflushed.current, 600);
      if (secondsDelta === 0 && !final) return;
      unflushed.current = 0;

      void recordReadingProgress({
        lessonPath,
        secondsDelta,
        scrollCompletion: latestScroll.current,
      });
    },
    [lessonPath],
  );

  // Tick only while the document is visible.
  useEffect(() => {
    if (complete) return;

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      unflushed.current += 1;
      setSeconds((value) => value + 1);
    }, 1000);

    const flushTimer = window.setInterval(() => flush(), FLUSH_INTERVAL_MS);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
    };
  }, [complete, flush]);

  // Flush on the way out. `pagehide` fires on mobile Safari where `unload`
  // does not, and `visibilitychange` catches tab switches.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flush(true);
    };
  }, [flush]);

  // Track how far through the article the reader has reached.
  useEffect(() => {
    const article = document.getElementById("lesson-body");
    if (!article) return;

    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const passed = -rect.top;
      const ratio = total <= 0 ? 1 : Math.min(1, Math.max(0, passed / total));
      if (ratio > latestScroll.current) {
        latestScroll.current = ratio;
        setScroll(ratio);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const eligibility = completionEligibility({
    durationMinutes,
    secondsSpent: seconds,
    scrollCompletion: scroll,
  });

  function onComplete() {
    setError(null);
    flush(true);
    startTransition(async () => {
      const result = await completeLesson(lessonPath);
      if (result.ok) {
        setComplete(true);
      } else {
        setError(result.message);
      }
    });
  }

  if (complete) {
    return (
      <div className="sticky bottom-0 z-20 -mx-4 mt-12 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Lesson complete
          </p>
          {nextHref ? (
            <Button asChild size="sm">
              <a href={nextHref}>Next lesson</a>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-12 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-48 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {formatDuration(seconds)} read
            </span>
            <span className="font-mono text-subtle-foreground tabular-nums">
              {Math.round(scroll * 100)}%
            </span>
          </div>
          <ProgressBar
            label="Reading progress through this lesson"
            value={scroll}
            size="sm"
            tone={eligibility.eligible ? "success" : "primary"}
          />
        </div>

        <div className="flex items-center gap-3">
          {!eligibility.eligible && eligibility.reason ? (
            <p className="text-xs text-subtle-foreground">{eligibility.reason}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button
            size="sm"
            onClick={onComplete}
            disabled={!eligibility.eligible || pending}
            aria-busy={pending}
          >
            {pending ? "Saving…" : "Mark complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return `${totalSeconds}s`;
  return `${minutes}m`;
}
