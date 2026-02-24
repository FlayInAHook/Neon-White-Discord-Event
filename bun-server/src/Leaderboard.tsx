import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bestOnly, setBestOnly] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const url = new URL("/api", window.location.origin);
      url.searchParams.set("bestOnly", bestOnly.toString());
      if (levelFilter !== "all") {
        url.searchParams.set("levelId", levelFilter);
      }
      
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
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [bestOnly, levelFilter]);

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

  const uniqueLevels = Array.from(new Set(entries.map(e => e.levelId)));

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold">Neon White Leaderboard</CardTitle>
        <div className="flex gap-4 items-center">
          <Select value={levelFilter} onValueChange={(val) => setLevelFilter(val || "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {uniqueLevels.map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              checked={bestOnly} 
              onChange={(e) => setBestOnly(e.target.checked)}
              className="rounded border-gray-300"
            />
            Best Times Only
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {loading && entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No entries found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell>{entry.levelId}</TableCell>
                  <TableCell className="text-right font-mono">{formatTime(entry.time)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
