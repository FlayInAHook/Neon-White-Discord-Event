import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, Scatter, Tooltip, XAxis, YAxis } from "recharts";

interface RunHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  levelId: string;
  levelName: string;
}

function formatTime(microseconds: number) {
  const ms = Math.floor(microseconds / 1000);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
}

const chartConfig = {
  currentPBLine: {
    label: "PB Progression",
    color: "#22c55e", // green-500
  },
  pbTimeRaw: {
    label: "Personal Best",
    color: "#16a34a", // green-600
  },
  nonPBTimeRaw: {
    label: "Completed (Non-PB)",
    color: "#6b7280", // gray-500
  },
  resetTimeRaw: {
    label: "Reset",
    color: "#ef4444", // red-500
  },
};

export function RunHistoryDialog({ open, onOpenChange, playerName, levelId, levelName }: RunHistoryDialogProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showNonPB, setShowNonPB] = useState(false);
  const [showResets, setShowResets] = useState(false);

  useEffect(() => {
    if (open && playerName && levelId) {
      setLoading(true);
      fetch(`/api/user-history?name=${encodeURIComponent(playerName)}&levelId=${encodeURIComponent(levelId)}`)
        .then(res => res.json())
        .then(data => {
          setHistory(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch history", err);
          setLoading(false);
        });
    } else {
      setHistory([]);
    }
  }, [open, playerName, levelId]);

  const chartData = useMemo(() => {
    let currentPB = Infinity;
    let attemptsSinceLastPB = 0;

    return history.map((run, index) => {
      let isPB = false;
      let pbTimeVal = null;
      let nonPBTimeVal = null;
      let resetTimeVal = null;
      let achievedAfter = 0;

      if (run.status === 'completed') {
        if (run.time < currentPB) {
          currentPB = run.time;
          isPB = true;
          pbTimeVal = run.time;
          achievedAfter = attemptsSinceLastPB + 1;
          attemptsSinceLastPB = 0;
        } else {
          nonPBTimeVal = run.time;
          attemptsSinceLastPB++;
        }
      } else {
        resetTimeVal = run.time;
        attemptsSinceLastPB++;
      }

      return {
        runNumber: index + 1,
        timeRaw: run.time,
        timeFormatted: formatTime(run.time),
        currentPBLine: currentPB === Infinity ? null : currentPB,
        pbTimeRaw: pbTimeVal,
        nonPBTimeRaw: nonPBTimeVal,
        resetTimeRaw: resetTimeVal,
        status: run.status,
        isPB,
        achievedAfter
      };
    }).map(point => {
      // Create a fresh copy to ensure reference identity changes for Recharts
      const p = { ...point };
      if (!showNonPB) p.nonPBTimeRaw = null;
      if (!showResets) p.resetTimeRaw = null;
      return p;
    });
  }, [history, showNonPB, showResets]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-md grid gap-1 text-sm min-w-[200px]">
          <div className="font-bold mb-1">Attempt #{data.runNumber}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Status:</span>
            <span>{data.status === 'completed' ? (data.isPB ? 'Personal Best 🏆' : 'Completed') : 'Reset'}</span>

            <span className="text-muted-foreground">Time:</span>
            <span className="font-mono">{data.timeFormatted}</span>

            {data.isPB && data.runNumber > 1 && (
              <>
                <span className="text-muted-foreground col-span-2 mt-1 border-t pt-1">
                  Achieved after {data.achievedAfter} run(s)
                </span>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] min-w-[85vw] max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Run History: {playerName}</DialogTitle>
          <DialogDescription>
            Progression on level <span className="font-semibold text-foreground">{levelName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-6 items-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showNonPB}
              onChange={e => setShowNonPB(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Show Completed (Non-PB) Runs
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showResets}
              onChange={e => setShowResets(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Show Resets
          </label>
        </div>

        <div className="flex-1 min-h-[65vh] flex flex-col">
          {loading ? (
            <div className="w-full h-full flex flex-col flex-1 justify-center space-y-4 px-4 pt-10">
              <Skeleton className="h-[70%] w-full rounded-xl" />
              <div className="space-y-2 w-full mt-4 flex items-center justify-center gap-4">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No runs found for this user and level.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="runNumber"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(val) => formatTime(val as number)}
                  domain={['auto', 'auto']}
                  scale="log"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="stepAfter"
                  dataKey="currentPBLine"
                  stroke="var(--color-currentPBLine)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />

                <Scatter dataKey="pbTimeRaw" fill="var(--color-pbTimeRaw)" isAnimationActive={false} />
                <Scatter dataKey="nonPBTimeRaw" fill="var(--color-nonPBTimeRaw)" isAnimationActive={false} />
                <Scatter dataKey="resetTimeRaw" fill="var(--color-resetTimeRaw)" isAnimationActive={false} />

                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
