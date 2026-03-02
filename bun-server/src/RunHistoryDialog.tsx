import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";

interface RunHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  levelId: string;
  levelName: string;
  allowResets?: boolean;
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

export function RunHistoryDialog({ open, onOpenChange, playerName, levelId, levelName, allowResets = true }: RunHistoryDialogProps) {
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

  console.time("RunHistoryDialog Render");

  const chartData = useMemo(() => {
    console.time("chartData computation");
    let currentPB = Infinity;
    let attemptsSinceLastPB = 0;

    const processed = history.map((run, index) => {
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
    }).filter(point => point.isPB).map(point => {
      // Create a fresh copy to ensure reference identity changes for Recharts
      const p = { ...point };
      // Hiding these options completely since we filter for PBs only now
      p.nonPBTimeRaw = null;
      p.resetTimeRaw = null;
      return p;
    });
    console.timeEnd("chartData computation");
    return processed;
  }, [history, showNonPB, showResets]);

  useEffect(() => {
    console.timeEnd("RunHistoryDialog Render");
  });

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
          {allowResets && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showResets}
                onChange={e => setShowResets(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Show Resets
            </label>
          )}
        </div>

        <div className="flex-1 min-h-[65vh] flex flex-col">
          {loading ? (<></>
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
                  type="number"
                  domain={['dataMin', 'dataMax']}
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
                  dot={{ r: 4, fill: "var(--color-currentPBLine)", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "var(--color-currentPBLine)", strokeWidth: 0 }}
                  isAnimationActive={false}
                />

                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
