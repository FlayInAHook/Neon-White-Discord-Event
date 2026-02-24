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
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // 10s
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

  const calculateOverall = () => {
    if (!config || entries.length === 0) return { average: [], weighted: [] };

    const players = Array.from(new Set(entries.map(e => e.name)));
    const totalPlayers = players.length;

    const playerStats: Record<string, { totalRank: number; totalPoints: number; levelsPlayed: number }> = {};
    players.forEach(p => {
      playerStats[p] = { totalRank: 0, totalPoints: 0, levelsPlayed: 0 };
    });

    config.levels.forEach(level => {
      // Calculate best times for ranking
      const levelEntries = entries
        .filter(e => e.levelId === level.id)
        .sort((a, b) => a.time - b.time);

      const playerRanks: Record<string, number> = {};
      levelEntries.forEach((entry, index) => {
        if (!playerRanks[entry.name]) {
          playerRanks[entry.name] = index + 1;
        }
      });

      players.forEach(player => {
        const stats = playerStats[player];
        if (!stats) return;

        const rank = playerRanks[player];
        if (rank) {
          stats.totalRank += rank;
          stats.levelsPlayed += 1;

          let points = totalPlayers - rank + 1;
          if (rank === 1) points += 5; // Bonus for 1st place
          stats.totalPoints += points;
        } else {
          stats.totalRank += totalPlayers;
        }
      });
    });

    const average = players.map(p => {
      const stats = playerStats[p];
      return {
        name: p,
        averageRank: stats ? stats.totalRank / config.levels.length : 0,
        levelsPlayed: stats ? stats.levelsPlayed : 0
      };
    }).sort((a, b) => a.averageRank - b.averageRank);

    const weighted = players.map(p => {
      const stats = playerStats[p];
      return {
        name: p,
        points: stats ? stats.totalPoints : 0,
        levelsPlayed: stats ? stats.levelsPlayed : 0
      };
    }).sort((a, b) => b.points - a.points);

    return { average, weighted };
  };

  const { average, weighted } = calculateOverall();

  if (!config) {
    return <div className="text-center py-8 text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 space-y-8 pb-16">
      <div className="text-center space-y-2 relative">
        <h1 className="text-4xl font-bold tracking-tight">Neon White Leaderboard</h1>
        <p className="text-xl text-muted-foreground">Chapter: {config.currentChapter}</p>

        <div className="absolute top-0 right-4 flex items-center gap-3 bg-muted/50 p-3 rounded-lg border">
          <label htmlFor="user-select" className="text-sm font-medium text-muted-foreground">Highlight Me:</label>
          <select
            id="user-select"
            className="bg-background border rounded-md px-3 py-1.5 text-sm"
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
                {average.map((player, index) => (
                  <TableRow key={player.name} className={player.name === currentUser ? "bg-primary/20 hover:bg-primary/30" : ""}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className={player.name === currentUser ? "font-bold" : ""}>{player.name}</TableCell>
                    <TableCell className="text-right font-mono">{player.averageRank.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{player.levelsPlayed} / {config.levels.length}</TableCell>
                  </TableRow>
                ))}
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
                {weighted.map((player, index) => (
                  <TableRow key={player.name} className={player.name === currentUser ? "bg-primary/20 hover:bg-primary/30" : ""}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className={player.name === currentUser ? "font-bold" : ""}>{player.name}</TableCell>
                    <TableCell className="text-right font-mono">{player.points}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{player.levelsPlayed} / {config.levels.length}</TableCell>
                  </TableRow>
                ))}
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

      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Solo Leaderboards</h2>
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
                      {levelEntries.slice(0, 10).map((entry, index) => (
                        <TableRow key={entry.id} className={entry.name === currentUser ? "bg-primary/20 hover:bg-primary/30" : ""}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className={`truncate max-w-[120px] ${entry.name === currentUser ? "font-bold" : ""}`} title={entry.name}>{entry.name}</TableCell>
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

      {teams.length > 0 && (
        <div className="space-y-4 pt-12">
          <h2 className="text-2xl font-bold tracking-tight">Team Leaderboards</h2>
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
                          <TableHead className="text-right">Combined Tries</TableHead>
                          <TableHead className="text-right">Combined Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTimes.slice(0, 10).map((teamInfo, index) => {
                          const isMyTeam = teamInfo!.name1 === currentUser || teamInfo!.name2 === currentUser;
                          return (
                            <TableRow key={index} className={isMyTeam ? "bg-primary/20 hover:bg-primary/30" : ""}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className={`truncate max-w-[120px] ${isMyTeam ? "font-bold" : ""}`} title={teamInfo!.teamName}>{teamInfo!.teamName}</TableCell>
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
    </div>
  );
}
