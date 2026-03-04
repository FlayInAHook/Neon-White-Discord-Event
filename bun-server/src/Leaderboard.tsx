import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState } from "react";
import { Minus, Equal, Trophy } from "lucide-react";
import { RunHistoryDialog } from "./RunHistoryDialog";

const currentUserAtom = atomWithStorage<string | null>("neon-white-current-user", null);
const showMicrosecondsAtom = atomWithStorage<boolean>("neon-white-show-microseconds", false);
const opponentAtom = atomWithStorage<string | null>("neon-white-opponent", null);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  id: number;
  name: string;
  levelId: string;
  time: number;
  status: string;
  tries?: number;
  created_at: string;
}

interface Config {
  currentChapter: string;
  levels: { id: string; name: string; chapterName: string }[];
}

interface Team {
  name1: string;
  name2: string;
}

interface OverallRow {
  name: string;
  stat: string;
  levelsPlayed: number;
  isActive: boolean;
}

interface LevelCardEntry {
  key: string | number;
  name: string;
  tries: number;
  time: number;
  isActive: boolean;
  isCurrentUser: boolean;
  isOpponent?: boolean;
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------

function ActiveDot({ position = "before" }: Readonly<{ position?: "before" | "after" }>) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ${position === "before" ? "mr-2" : "ml-2"}`}
      title="Recently active"
    />
  );
}

function EmptyRow({ colSpan, message }: Readonly<{ colSpan: number; message: string }>) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-4 text-muted-foreground text-sm">
        {message}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// OverallCard – reusable card for the three overall ranking tables
// ---------------------------------------------------------------------------

function OverallCard({
  title,
  statHeader,
  description,
  rows,
  levelCount,
  currentUser,
  opponent,
  leaderboardType,
}: Readonly<{
  title: string;
  statHeader: string;
  description?: string;
  rows: OverallRow[];
  levelCount: number;
  currentUser: string | null;
  opponent: string | null;
  leaderboardType: "solo" | "team";
}>) {
  const hasOpponent = !!opponent;
  const meClass = hasOpponent ? "bg-sky-500/20 hover:bg-sky-500/30" : "bg-primary/20 hover:bg-primary/30";
  const meFontColor = hasOpponent ? "text-sky-500" : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20px]">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">{statHeader}</TableHead>
              <TableHead className="text-right">Levels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((player, index) => {
              const isHighlighted = !!currentUser && (
                leaderboardType === "solo"
                  ? player.name === currentUser
                  : player.name.includes(currentUser)
              );
              const isOpponent = !!opponent && (
                leaderboardType === "solo"
                  ? player.name === opponent
                  : player.name.includes(opponent)
              );
              let rowClass = "";
              if (isHighlighted) rowClass = meClass;
              else if (isOpponent) rowClass = "bg-amber-500/20 hover:bg-amber-500/30";
              let nameFontClass = "";
              if (isHighlighted) nameFontClass = `font-bold ${meFontColor}`;
              else if (isOpponent) nameFontClass = "font-bold";
              return (
                <TableRow key={player.name} className={rowClass}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className={`${nameFontClass}`}>
                    {player.isActive && <ActiveDot />}
                    {player.name}
                    {isOpponent && <span className="ml-2 text-xs text-amber-500 font-normal">(opponent)</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{player.stat}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{player.levelsPlayed} / {levelCount}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <EmptyRow colSpan={4} message="No data available" />}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LevelCard – reusable card for per-level leaderboards (solo & team)
// ---------------------------------------------------------------------------

function LevelCard({
  levelName,
  nameHeader,
  entries,
  formatTime,
  emptyMessage,
  hasOpponent,
}: Readonly<{
  levelName: string;
  nameHeader: string;
  entries: LevelCardEntry[];
  formatTime: (t: number) => string;
  emptyMessage: string;
  hasOpponent?: boolean;
}>) {
  const meRowClass = hasOpponent ? "bg-sky-500/20 hover:bg-sky-500/30" : "bg-primary/20 hover:bg-primary/30";
  const meFontColor = hasOpponent ? "text-sky-500" : "";
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{levelName}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20px]">#</TableHead>
              <TableHead>{nameHeader}</TableHead>
              <TableHead className="text-right">Tries</TableHead>
              <TableHead className="text-right">Best Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 15).map((entry, index) => {
              let rowClass = "hover:bg-muted/50";
              if (entry.isCurrentUser) rowClass = meRowClass;
              else if (entry.isOpponent) rowClass = "bg-amber-500/20 hover:bg-amber-500/30";
              let nameFontClass = "";
              if (entry.isCurrentUser) nameFontClass = `font-bold ${meFontColor}`;
              else if (entry.isOpponent) nameFontClass = "font-bold";
              return (
                <TableRow
                  key={entry.key}
                  className={`${entry.onClick ? "cursor-pointer " : ""}${rowClass}`}
                  onClick={entry.onClick}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className={nameFontClass} title={entry.name}>
                    {entry.isActive && <ActiveDot />}
                    {entry.name}
                    {entry.isOpponent && <span className="ml-2 text-xs text-amber-500 font-normal">(opponent)</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{entry.tries}</TableCell>
                  <TableCell className="text-right font-mono">{formatTime(entry.time)}</TableCell>
                </TableRow>
              );
            })}
            {entries.length === 0 && <EmptyRow colSpan={4} message={emptyMessage} />}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function H2HWinnerIcon({ diff }: Readonly<{ diff: number | null }>) {
  if (diff === null) return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
  if (diff < 0) return <Trophy className="mx-auto h-4 w-4 text-sky-500" />;
  if (diff > 0) return <Trophy className="mx-auto h-4 w-4 text-amber-500" />;
  return <Equal className="mx-auto h-4 w-4 text-muted-foreground" />;
}

function h2hDiffClass(diff: number | null): string {
  if (diff === null || diff === 0) return "";
  return diff < 0 ? "text-sky-500" : "text-amber-500";
}

// ---------------------------------------------------------------------------
// HeadToHeadRow – one level row inside the H2H summary table
// ---------------------------------------------------------------------------

function HeadToHeadRow({
  levelName,
  userEntry,
  opponentEntry,
  showMicroseconds,
}: Readonly<{
  levelName: string;
  userEntry: LeaderboardEntry | undefined;
  opponentEntry: LeaderboardEntry | undefined;
  showMicroseconds: boolean;
}>) {
  const diff = userEntry && opponentEntry ? userEntry.time - opponentEntry.time : null;
  const userWins = diff !== null && diff < 0;
  const opWins = diff !== null && diff > 0;
  const diffColorClass = h2hDiffClass(diff);

  return (
    <TableRow>
      <TableCell className="font-medium">{levelName}</TableCell>
      <TableCell className={`text-right font-mono bg-sky-500/10 ${userWins ? "text-sky-500 font-bold" : ""}`}>
        {userEntry ? formatTime(userEntry.time, showMicroseconds) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center"><H2HWinnerIcon diff={diff} /></TableCell>
      <TableCell className={`font-mono bg-amber-500/10 ${opWins ? "text-amber-500 font-bold" : ""}`}>
        {opponentEntry ? formatTime(opponentEntry.time, showMicroseconds) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right font-mono text-sm text-muted-foreground">
        {diff !== null && (
          <span className={diffColorClass}>
            {diff < 0 ? "-" : "+"}{formatTime(Math.abs(diff), showMicroseconds)}
          </span>
        )}
        {diff === null && "—"}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(microseconds: number, showMicros = false): string {
  const totalMs = Math.floor(microseconds / 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  const remainingMicros = microseconds % 1000;

  const msPart = milliseconds.toString().padStart(3, "0");
  const microsPart = showMicros ? remainingMicros.toString().padStart(3, "0") : "";
  const fraction = showMicros ? `${msPart}|${microsPart}` : msPart;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction}`;
  }
  return `${seconds}.${fraction}`;
}

function isParticipantActive(name: string, activeNames: string[], mode: "solo" | "team"): boolean {
  if (mode === "solo") return activeNames.includes(name);
  return name.split(" & ").some(n => activeNames.includes(n));
}

function buildTeamLevelRankings(
  levelEntries: LeaderboardEntry[],
  teams: Team[]
): { name: string; time: number }[] {
  return teams
    .map(team => {
      const e1 = levelEntries.find(e => e.name === team.name1);
      const e2 = levelEntries.find(e => e.name === team.name2);
      return e1 && e2 ? { name: `${team.name1} & ${team.name2}`, time: e1.time + e2.time } : null;
    })
    .filter((t): t is { name: string; time: number } => t !== null)
    .sort((a, b) => a.time - b.time);
}

function buildTeamLevelEntries(
  levelId: string,
  levelEntries: LeaderboardEntry[],
  teams: Team[],
  activePlayersLevel: { name: string; levelId: string }[],
  currentUser: string | null,
  opponent: string | null
): LevelCardEntry[] {
  return buildTeamLevelRankings(levelEntries, teams).map(ranking => {
    const team = teams.find(t => `${t.name1} & ${t.name2}` === ranking.name)!;
    const e1 = levelEntries.find(e => e.name === team.name1)!;
    const e2 = levelEntries.find(e => e.name === team.name2)!;
    return {
      key: ranking.name,
      name: ranking.name,
      tries: (e1.tries ?? 1) + (e2.tries ?? 1),
      time: ranking.time,
      isActive:
        activePlayersLevel.some(ap => ap.name === team.name1 && ap.levelId === levelId) ||
        activePlayersLevel.some(ap => ap.name === team.name2 && ap.levelId === levelId),
      isCurrentUser: team.name1 === currentUser || team.name2 === currentUser,
      isOpponent: !!opponent && (team.name1 === opponent || team.name2 === opponent),
    };
  });
}

// ---------------------------------------------------------------------------
// Main Leaderboard component
// ---------------------------------------------------------------------------

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [showMicroseconds, setShowMicroseconds] = useAtom(showMicrosecondsAtom);
  const [opponent, setOpponent] = useAtom(opponentAtom);
  const [leaderboardType, setLeaderboardType] = useState<"solo" | "team">("solo");
  const [activePlayersGlobal, setActivePlayersGlobal] = useState<{ name: string; levelId: string }[]>([]);
  const [activePlayersLevel, setActivePlayersLevel] = useState<{ name: string; levelId: string }[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<{ playerName: string; levelId: string; levelName: string } | null>(null);

  const activePlayerNamesGlobal = useMemo(() => activePlayersGlobal.map(p => p.name), [activePlayersGlobal]);

  const allPlayers = useMemo(() => Array.from(new Set(entries.map(e => e.name))).sort((a, b) => a.localeCompare(b)), [entries]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) setConfig(await res.json());
    } catch (e) {
      console.error("Failed to fetch config", e);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) setTeams(await res.json());
    } catch (e) {
      console.error("Failed to fetch teams", e);
    }
  };

  const fetchActivePlayers = async () => {
    try {
      const res = await fetch("/api/active-players");
      if (res.ok) {
        const data = await res.json();
        setActivePlayersGlobal(data.global);
        setActivePlayersLevel(data.level);
      }
    } catch (e) {
      console.error("Failed to fetch active players", e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const url = new URL("/api", globalThis.location.origin);
      url.searchParams.set("bestOnly", "true");
      const res = await fetch(url.toString());
      if (res.ok) setEntries(await res.json());
    } catch (e) {
      console.error("Failed to fetch leaderboard", e);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchTeams();
    fetchActivePlayers();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(() => {
      fetchLeaderboard();
      fetchActivePlayers();
    }, 10_000);
    const teamsInterval = setInterval(fetchTeams, 30_000);
    return () => {
      clearInterval(interval);
      clearInterval(teamsInterval);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Overall statistics calculation
  // -------------------------------------------------------------------------

  const calculateOverall = (mode: "solo" | "team") => {
    if (!config || entries.length === 0) return { average: [], weighted: [], totalTime: [] };

    const participants: string[] =
      mode === "solo"
        ? Array.from(new Set(entries.map(e => e.name)))
        : teams.map(t => `${t.name1} & ${t.name2}`);

    const totalParticipants = participants.length;
    if (totalParticipants === 0) return { average: [], weighted: [], totalTime: [] };

    const statsMap: Record<string, { totalRank: number; totalPoints: number; levelsPlayed: number; totalTime: number }> = {};
    participants.forEach(p => {
      statsMap[p] = { totalRank: 0, totalPoints: 0, levelsPlayed: 0, totalTime: 0 };
    });

    config.levels.forEach(level => {
      let levelRankings: { name: string; time: number }[];

      if (mode === "solo") {
        levelRankings = entries
          .filter(e => e.levelId === level.id)
          .map(e => ({ name: e.name, time: e.time }))
          .sort((a, b) => a.time - b.time);
      } else {
        const levelEntries = entries.filter(e => e.levelId === level.id);
        levelRankings = buildTeamLevelRankings(levelEntries, teams);
      }

      const ranksMap: Record<string, number> = {};
      levelRankings.forEach((entry, index) => {
        if (!ranksMap[entry.name]) ranksMap[entry.name] = index + 1;
      });

      const timeMap: Record<string, number> = {};
      levelRankings.forEach(entry => {
        timeMap[entry.name] = entry.time;
      });

      participants.forEach(participant => {
        const stats = statsMap[participant];
        if (!stats) return;
        const rank = ranksMap[participant];
        if (rank) {
          stats.totalRank += rank;
          stats.levelsPlayed += 1;
          stats.totalTime += timeMap[participant] ?? 0;
          let points = totalParticipants - rank + 1;
          if (rank === 1) points += 3;
          if (rank === 2) points += 2;
          if (rank === 3) points += 1;
          stats.totalPoints += points;
        } else {
          stats.totalRank += totalParticipants;
        }
      });
    });

    const average: OverallRow[] = participants
      .map(p => ({
        name: p,
        stat: ((statsMap[p]?.totalRank ?? 0) / config.levels.length).toFixed(2),
        levelsPlayed: statsMap[p]?.levelsPlayed ?? 0,
        isActive: isParticipantActive(p, activePlayerNamesGlobal, mode),
      }))
      .sort((a, b) => Number.parseFloat(a.stat) - Number.parseFloat(b.stat));

    const weighted: OverallRow[] = participants
      .map(p => ({
        name: p,
        stat: String(statsMap[p]?.totalPoints ?? 0),
        levelsPlayed: statsMap[p]?.levelsPlayed ?? 0,
        isActive: isParticipantActive(p, activePlayerNamesGlobal, mode),
      }))
      .sort((a, b) => Number.parseInt(b.stat) - Number.parseInt(a.stat));

    // Total Time: only include participants who have completed every level
    const totalTime: OverallRow[] = participants
      .filter(p => (statsMap[p]?.levelsPlayed ?? 0) === config.levels.length)
      .map(p => ({
        name: p,
        stat: formatTime(statsMap[p]?.totalTime ?? 0, showMicroseconds),
        levelsPlayed: statsMap[p]?.levelsPlayed ?? 0,
        isActive: isParticipantActive(p, activePlayerNamesGlobal, mode),
      }))
      .sort((a, b) => (statsMap[a.name]?.totalTime ?? 0) - (statsMap[b.name]?.totalTime ?? 0));

    return { average, weighted, totalTime };
  };

  const { average, weighted, totalTime } = calculateOverall(leaderboardType);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!config) {
    return <div className="text-center py-8 text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="w-full max-w-8xl mx-auto mt-8 space-y-8 pb-16">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-2">
        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Neon White Leaderboard</h1>
          <p className="text-xl text-muted-foreground">Chapter: {config.currentChapter}</p>
        </div>

        <div className="flex flex-wrap items-center w-full sm:w-auto gap-3 bg-muted/50 p-3 rounded-lg border">
          <label htmlFor="user-select" className="text-sm font-medium text-muted-foreground shrink-0">Highlight Me:</label>
          <Select value={currentUser ?? ""} onValueChange={(v) => setCurrentUser(v || null)}>
            <SelectTrigger id="user-select" className="w-full sm:w-48">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {allPlayers.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUser && (
            <>
              <span className="text-muted-foreground text-sm font-medium shrink-0">vs</span>
              <div className="flex items-center gap-2">
                <label htmlFor="opponent-select" className="text-sm font-medium text-amber-500 shrink-0">Head to Head:</label>
                <Select value={opponent ?? ""} onValueChange={(v) => setOpponent(v || null)}>
                  <SelectTrigger id="opponent-select" className="w-full sm:w-48 border-amber-500/50">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {allPlayers.filter(p => p !== currentUser).map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <label htmlFor="show-micros" className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer select-none shrink-0">
            <Switch
              id="show-micros"
              checked={showMicroseconds}
              onCheckedChange={setShowMicroseconds}
            />
            Microseconds
          </label>
        </div>
      </div>

      {/* Solo / Team toggle */}
      <div className="flex justify-center mb-6">
        <div className="bg-muted p-1 rounded-lg inline-flex">
          {(["solo", "team"] as const).map(type => (
            <button
              key={type}
              className={`px-8 py-2 rounded-md text-sm font-medium transition-colors capitalize ${leaderboardType === type ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
              onClick={() => setLeaderboardType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Overall ranking cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <OverallCard
          title="Average Placement"
          statHeader="Avg Rank"
          description="Lower is better. Players who haven't submitted a time for a level are counted as last place for that level."
          rows={average}
          levelCount={config.levels.length}
          currentUser={currentUser}
          opponent={opponent}
          leaderboardType={leaderboardType}
        />
        <OverallCard
          title="Weighted Points"
          statHeader="Points"
          description="Higher is better. Each level awards (players − rank + 1) points. 1st place earns an extra 5 bonus points."
          rows={weighted}
          levelCount={config.levels.length}
          currentUser={currentUser}
          opponent={opponent}
          leaderboardType={leaderboardType}
        />
        <OverallCard
          title="Total Time"
          statHeader="Time"
          description="Sum of best times across all levels. Only players who have a time on every level are listed."
          rows={totalTime}
          levelCount={config.levels.length}
          currentUser={currentUser}
          opponent={opponent}
          leaderboardType={leaderboardType}
        />
      </div>

      {/* Head to Head summary */}
      {currentUser && opponent && leaderboardType === "solo" && (
        <div className="space-y-4 pt-4">
          <h2 className="text-2xl font-bold tracking-tight">
            <span className="text-sky-500">{currentUser}</span>
            <span className="text-muted-foreground mx-3">vs</span>
            <span className="text-amber-500">{opponent}</span>
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right text-sky-500 bg-sky-500/10">{currentUser}</TableHead>
                  <TableHead className="text-center w-[50px]">Winner</TableHead>
                  <TableHead className="text-left text-amber-500 bg-amber-500/10">{opponent}</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.levels.map(level => {
                  const userEntry = entries.find(e => e.levelId === level.id && e.name === currentUser);
                  const opponentEntry = entries.find(e => e.levelId === level.id && e.name === opponent);
                  return (
                    <HeadToHeadRow
                      key={level.id}
                      levelName={level.name}
                      userEntry={userEntry}
                      opponentEntry={opponentEntry}
                      showMicroseconds={showMicroseconds}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Per-level leaderboards – Solo */}
      {leaderboardType === "solo" && (
        <div className="space-y-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Solo Level Leaderboards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {config.levels.map(level => {
              const levelEntries: LevelCardEntry[] = entries
                .filter(e => e.levelId === level.id)
                .sort((a, b) => a.time - b.time)
                .map(e => ({
                  key: e.id,
                  name: e.name,
                  tries: e.tries ?? 1,
                  time: e.time,
                  isActive: activePlayersLevel.some(ap => ap.name === e.name && ap.levelId === level.id),
                  isCurrentUser: e.name === currentUser,
                  isOpponent: e.name === opponent,
                  onClick: () => setSelectedHistory({ playerName: e.name, levelId: level.id, levelName: level.name }),
                }));

              return (
                <LevelCard
                  key={level.id}
                  levelName={level.name}
                  nameHeader="Player"
                  entries={levelEntries}
                  formatTime={(t) => formatTime(t, showMicroseconds)}
                  emptyMessage="No times yet"
                  hasOpponent={!!opponent}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Per-level leaderboards – Team */}
      {leaderboardType === "team" && teams.length > 0 && (
        <div className="space-y-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Team Level Leaderboards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {config.levels.map(level => {
              const levelEntries = entries.filter(e => e.levelId === level.id);
              const teamEntries = buildTeamLevelEntries(
                level.id,
                levelEntries,
                teams,
                activePlayersLevel,
                currentUser,
                opponent
              );

              return (
                <LevelCard
                  key={`team-${level.id}`}
                  levelName={level.name}
                  nameHeader="Team"
                  entries={teamEntries}
                  formatTime={(t) => formatTime(t, showMicroseconds)}
                  emptyMessage="No complete team times yet"
                  hasOpponent={!!opponent}
                />
              );
            })}
          </div>
        </div>
      )}

      {selectedHistory && (
        <RunHistoryDialog
          open={!!selectedHistory}
          onOpenChange={(open) => !open && setSelectedHistory(null)}
          playerName={selectedHistory.playerName}
          levelId={selectedHistory.levelId}
          levelName={selectedHistory.levelName}
          allowResets={false}
        />
      )}
    </div>
  );
}
