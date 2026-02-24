import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  id: number;
  name: string;
  levelId: string;
  time: number;
  created_at: string;
}

interface Config {
  currentChapter: string;
  levels: { id: string; name: string; chapterName: string }[];
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const url = new URL("/api", window.location.origin);
      url.searchParams.set("bestOnly", "true"); // Always fetch best times for overall calculations
      
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
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // Refresh every 10s
    return () => clearInterval(interval);
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
      const levelEntries = entries.filter(e => e.levelId === level.id).sort((a, b) => a.time - b.time);
      
      const playerRanks: Record<string, number> = {};
      levelEntries.forEach((entry, index) => {
        if (!playerRanks[entry.name]) {
          playerRanks[entry.name] = index + 1;
        }
      });

      players.forEach(player => {
        const rank = playerRanks[player];
        if (rank) {
          playerStats[player].totalRank += rank;
          playerStats[player].levelsPlayed += 1;
          
          let points = totalPlayers - rank + 1;
          if (rank === 1) points += 5; // Bonus for 1st place
          playerStats[player].totalPoints += points;
        } else {
          playerStats[player].totalRank += totalPlayers + 1; // Penalty for not playing
        }
      });
    });

    const average = players.map(p => ({
      name: p,
      averageRank: playerStats[p].totalRank / config.levels.length,
      levelsPlayed: playerStats[p].levelsPlayed
    })).sort((a, b) => a.averageRank - b.averageRank);

    const weighted = players.map(p => ({
      name: p,
      points: playerStats[p].totalPoints,
      levelsPlayed: playerStats[p].levelsPlayed
    })).sort((a, b) => b.points - a.points);

    return { average, weighted };
  };

  const { average, weighted } = calculateOverall();

  if (!config) {
    return <div className="text-center py-8 text-muted-foreground">Loading configuration...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto mt-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Neon White Leaderboard</h1>
        <p className="text-xl text-muted-foreground">Chapter: {config.currentChapter}</p>
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
                  <TableRow key={player.name}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{player.name}</TableCell>
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
                  <TableRow key={player.name}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{player.name}</TableCell>
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
        <h2 className="text-2xl font-bold tracking-tight">Level Leaderboards</h2>
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
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levelEntries.slice(0, 10).map((entry, index) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="truncate max-w-[120px]" title={entry.name}>{entry.name}</TableCell>
                          <TableCell className="text-right font-mono">{formatTime(entry.time)}</TableCell>
                        </TableRow>
                      ))}
                      {levelEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">No times yet</TableCell>
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
    </div>
  );
}
