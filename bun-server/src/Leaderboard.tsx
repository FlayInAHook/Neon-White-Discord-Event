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

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [leaderboardType, setLeaderboardType] = useState<"solo" | "team">("solo");
  const [activePlayersGlobal, setActivePlayersGlobal] = useState<{ name: string, levelId: string }[]>([]);
  const [activePlayersLevel, setActivePlayersLevel] = useState<{ name: string, levelId: string }[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<{ playerName: string, levelId: string, levelName: string } | null>(null);

  const activePlayerNamesGlobal = useMemo(() => activePlayersGlobal.map(p => p.name), [activePlayersGlobal]);

  const allPlayers = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.name))).sort();
  }, [entries]);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error("Failed to fetch config", e);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
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
    setLoading(true);
    try {
      const url = new URL("/api", window.location.origin);
      url.searchParams.set("bestOnly", "true"); // Server now aggregates tries!

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard", e);
    } finally {
      setLoading(false);
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
    }, 10000); // 10s
    const teamsInterval = setInterval(fetchTeams, 30000); // 30s
    return () => {
      clearInterval(interval);
      clearInterval(teamsInterval);
    };
  }, []);

  const formatTime = (microseconds: number) => {
    const ms = Math.floor(microseconds / 1000);
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    return `${seconds}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const calculateOverall = (mode: "solo" | "team") => {
    if (!config || entries.length === 0) return { average: [], weighted: [] };

    let participants: string[] = [];
    if (mode === "solo") {
      participants = Array.from(new Set(entries.map(e => e.name)));
    } else {
      participants = teams.map(t => `${t.name1} & ${t.name2}`);
    }

    const totalParticipants = participants.length;
    if (totalParticipants === 0) return { average: [], weighted: [] };

    const statsMap: Record<string, { totalRank: number; totalPoints: number; levelsPlayed: number }> = {};
    participants.forEach(p => {
      statsMap[p] = { totalRank: 0, totalPoints: 0, levelsPlayed: 0 };
    });

    config.levels.forEach(level => {
      let levelRankings: { name: string; time: number }[] = [];

      if (mode === "solo") {
        levelRankings = entries
          .filter(e => e.levelId === level.id)
          .map(e => ({ name: e.name, time: e.time }))
          .sort((a, b) => a.time - b.time);
      } else {
        const levelEntries = entries.filter(e => e.levelId === level.id);
        const teamTimes = teams.map(team => {
          const e1 = levelEntries.find(e => e.name === team.name1);
          const e2 = levelEntries.find(e => e.name === team.name2);
          if (e1 && e2) {
            return {
              name: `${team.name1} & ${team.name2}`,
              time: e1.time + e2.time
            };
          }
          return null;
        }).filter(t => t !== null) as { name: string; time: number }[];

        levelRankings = teamTimes.sort((a, b) => a.time - b.time);
      }

      const ranksMap: Record<string, number> = {};
      levelRankings.forEach((entry, index) => {
        if (!ranksMap[entry.name]) {
          ranksMap[entry.name] = index + 1;
        }
      });

      participants.forEach(participant => {
        const stats = statsMap[participant];
        if (!stats) return;

        const rank = ranksMap[participant];
        if (rank) {
          stats.totalRank += rank;
          stats.levelsPlayed += 1;

          let points = totalParticipants - rank + 1;
          if (rank === 1) points += 5; // Bonus for 1st place
          stats.totalPoints += points;
        } else {
          stats.totalRank += totalParticipants;
        }
      });
    });

    const average = participants.map(p => {
      const stats = statsMap[p];
      return {
        name: p,
        averageRank: stats ? stats.totalRank / config.levels.length : 0,
        levelsPlayed: stats ? stats.levelsPlayed : 0
      };
    }).sort((a, b) => a.averageRank - b.averageRank);

    const weighted = participants.map(p => {
      const stats = statsMap[p];
      return {
        name: p,
        points: stats ? stats.totalPoints : 0,
        levelsPlayed: stats ? stats.levelsPlayed : 0
      };
    }).sort((a, b) => b.points - a.points);

    return { average, weighted };
  };

  const { average, weighted } = calculateOverall(leaderboardType);

  if (!config) {
    return <div className="text-center py-8 text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="w-full max-w-8xl mx-auto mt-8 space-y-8 pb-16">
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
            {allPlayers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <div className="bg-muted p-1 rounded-lg inline-flex">
          <button
            className={`px-8 py-2 rounded-md text-sm font-medium transition-colors ${leaderboardType === 'solo' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
            onClick={() => setLeaderboardType('solo')}
          >
            Solo
          </button>
          <button
            className={`px-8 py-2 rounded-md text-sm font-medium transition-colors ${leaderboardType === 'team' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
            onClick={() => setLeaderboardType('team')}
          >
            Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Average Placement</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Avg Rank</TableHead>
                  <TableHead className="text-right">Levels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {average.map((player, index) => {
                  const isHighlighted = currentUser && (leaderboardType === "solo" ? player.name === currentUser : player.name.includes(currentUser));
                  return (
                    <TableRow key={player.name} className={isHighlighted ? "bg-primary/20 hover:bg-primary/30" : ""}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className={isHighlighted ? "font-bold" : ""}>
                        {player.name}
                        {leaderboardType === "solo"
                          ? (activePlayerNamesGlobal.includes(player.name) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />)
                          : (player.name.split(" & ").some(n => activePlayerNamesGlobal.includes(n)) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{player.averageRank.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{player.levelsPlayed} / {config.levels.length}</TableCell>
                    </TableRow>
                  );
                })}
                {average.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weighted Points</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Levels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weighted.map((player, index) => {
                  const isHighlighted = currentUser && (leaderboardType === "solo" ? player.name === currentUser : player.name.includes(currentUser));
                  return (
                    <TableRow key={player.name} className={isHighlighted ? "bg-primary/20 hover:bg-primary/30" : ""}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className={isHighlighted ? "font-bold" : ""}>
                        {player.name}
                        {leaderboardType === "solo"
                          ? (activePlayerNamesGlobal.includes(player.name) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />)
                          : (player.name.split(" & ").some(n => activePlayerNamesGlobal.includes(n)) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{player.points}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{player.levelsPlayed} / {config.levels.length}</TableCell>
                    </TableRow>
                  );
                })}
                {weighted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {leaderboardType === "solo" && (
        <div className="space-y-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Solo Level Leaderboards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {config.levels.map(level => {
              const levelEntries = entries
                .filter(e => e.levelId === level.id)
                .sort((a, b) => a.time - b.time);

              return (
                <Card key={level.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{level.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-right">Tries</TableHead>
                          <TableHead className="text-right">Best Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {levelEntries.slice(0, 15).map((entry, index) => (
                          <TableRow
                            key={entry.id}
                            className={`cursor-pointer ${entry.name === currentUser ? "bg-primary/20 hover:bg-primary/30" : "hover:bg-muted/50"}`}
                            onClick={() => setSelectedHistory({ playerName: entry.name, levelId: level.id, levelName: level.name })}
                          >
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className={`truncate max-w-[120px] ${entry.name === currentUser ? "font-bold" : ""}`} title={entry.name}>
                              {entry.name}
                              {activePlayersLevel.some(ap => ap.name === entry.name && ap.levelId === level.id) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{entry.tries || 1}</TableCell>
                            <TableCell className="text-right font-mono">{formatTime(entry.time)}</TableCell>
                          </TableRow>
                        ))}
                        {levelEntries.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">No times yet</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {leaderboardType === "team" && teams.length > 0 && (
        <div className="space-y-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Team Level Leaderboards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {config.levels.map(level => {
              const levelEntries = entries.filter(e => e.levelId === level.id);

              const teamTimes = teams.map(team => {
                const e1 = levelEntries.find(e => e.name === team.name1);
                const e2 = levelEntries.find(e => e.name === team.name2);

                if (e1 && e2) {
                  return {
                    teamName: `${team.name1} & ${team.name2}`,
                    name1: team.name1,
                    name2: team.name2,
                    time: e1.time + e2.time,
                    tries: (e1.tries || 1) + (e2.tries || 1)
                  }
                }
                return null;
              }).filter(t => t !== null).sort((a, b) => a!.time - b!.time);

              return (
                <Card key={`team-${level.id}`} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{level.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Tries</TableHead>
                          <TableHead className="text-right">Best Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTimes.slice(0, 15).map((teamInfo, index) => {
                          const isMyTeam = teamInfo!.name1 === currentUser || teamInfo!.name2 === currentUser;
                          return (
                            <TableRow key={index} className={isMyTeam ? "bg-primary/20 hover:bg-primary/30" : ""}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className={`truncate max-w-[120px] ${isMyTeam ? "font-bold" : ""}`} title={teamInfo!.teamName}>
                                {teamInfo!.teamName}
                                {(activePlayersLevel.some(ap => ap.name === teamInfo!.name1 && ap.levelId === level.id) || activePlayersLevel.some(ap => ap.name === teamInfo!.name2 && ap.levelId === level.id)) && <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" title="Recently active" />}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">{teamInfo!.tries}</TableCell>
                              <TableCell className="text-right font-mono">{formatTime(teamInfo!.time)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {teamTimes.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">No complete team times yet</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
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
        />
      )}
    </div>
  );
}
