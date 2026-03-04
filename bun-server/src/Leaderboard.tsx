import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEffect, useMemo, useState } from "react";
import { RunHistoryDialog } from "./RunHistoryDialog";

const currentUserAtom = atomWithStorage<string | null>("neon-white-current-user", null);

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
  rows,
  levelCount,
  currentUser,
  leaderboardType,
}: Readonly<{
  title: string;
  statHeader: string;
  rows: OverallRow[];
  levelCount: number;
  currentUser: string | null;
  leaderboardType: "solo" | "team";
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
              return (
                <TableRow key={player.name} className={isHighlighted ? "bg-primary/20 hover:bg-primary/30" : ""}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className={isHighlighted ? "font-bold" : ""}>
                    {player.isActive && <ActiveDot />}
                    {player.name}
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
}: Readonly<{
  levelName: string;
  nameHeader: string;
  entries: LevelCardEntry[];
  formatTime: (t: number) => string;
  emptyMessage: string;
}>) {
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
            {entries.slice(0, 15).map((entry, index) => (
              <TableRow
                key={entry.key}
                className={`${entry.onClick ? "cursor-pointer " : ""}${entry.isCurrentUser ? "bg-primary/20 hover:bg-primary/30" : "hover:bg-muted/50"}`}
                onClick={entry.onClick}
              >
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell className={/*truncate max-w-[120px]*/`${entry.isCurrentUser ? "font-bold" : ""}`} title={entry.name}>
                  {entry.isActive && <ActiveDot />}
                  {entry.name}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{entry.tries}</TableCell>
                <TableCell className="text-right font-mono">{formatTime(entry.time)}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && <EmptyRow colSpan={4} message={emptyMessage} />}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(microseconds: number): string {
  const ms = Math.floor(microseconds / 1000);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(3, "0")}`;
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
  currentUser: string | null
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
        stat: formatTime(statsMap[p]?.totalTime ?? 0),
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

        <div className="flex items-center w-full sm:w-auto gap-3 bg-muted/50 p-3 rounded-lg border">
          <label htmlFor="user-select" className="text-sm font-medium text-muted-foreground shrink-0">Highlight Me:</label>
          <select
            id="user-select"
            className="bg-background border rounded-md px-3 py-1.5 text-sm w-full min-w-0 sm:w-48 truncate"
            value={currentUser || ""}
            onChange={(e) => setCurrentUser(e.target.value || null)}
          >
            <option value="">None</option>
            {allPlayers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
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
          rows={average}
          levelCount={config.levels.length}
          currentUser={currentUser}
          leaderboardType={leaderboardType}
        />
        <OverallCard
          title="Weighted Points"
          statHeader="Points"
          rows={weighted}
          levelCount={config.levels.length}
          currentUser={currentUser}
          leaderboardType={leaderboardType}
        />
        <OverallCard
          title="Total Time"
          statHeader="Time"
          rows={totalTime}
          levelCount={config.levels.length}
          currentUser={currentUser}
          leaderboardType={leaderboardType}
        />
      </div>

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
                  onClick: () => setSelectedHistory({ playerName: e.name, levelId: level.id, levelName: level.name }),
                }));

              return (
                <LevelCard
                  key={level.id}
                  levelName={level.name}
                  nameHeader="Player"
                  entries={levelEntries}
                  formatTime={formatTime}
                  emptyMessage="No times yet"
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
                currentUser
              );

              return (
                <LevelCard
                  key={`team-${level.id}`}
                  levelName={level.name}
                  nameHeader="Team"
                  entries={teamEntries}
                  formatTime={formatTime}
                  emptyMessage="No complete team times yet"
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
