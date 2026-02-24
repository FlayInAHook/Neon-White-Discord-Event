import { Database } from "bun:sqlite";

const db = new Database("leaderboard.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    levelId TEXT NOT NULL,
    time INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface LeaderboardEntry {
  id: number;
  name: string;
  levelId: string;
  time: number;
  created_at: string;
}

export function addEntry(name: string, levelId: string, time: number) {
  const query = db.query(`
    INSERT INTO leaderboard (name, levelId, time)
    VALUES ($name, $levelId, $time)
  `);
  query.run({ $name: name, $levelId: levelId, $time: time });
}

export function getLeaderboard(levelId?: string): LeaderboardEntry[] {
  if (levelId) {
    const query = db.query(`
      SELECT * FROM leaderboard
      WHERE levelId = $levelId
      ORDER BY time ASC
    `);
    return query.all({ $levelId: levelId }) as LeaderboardEntry[];
  } else {
    const query = db.query(`
      SELECT * FROM leaderboard
      ORDER BY time ASC
    `);
    return query.all() as LeaderboardEntry[];
  }
}

export function getBestTimes(): LeaderboardEntry[] {
  // Get the best time for each player per level
  const query = db.query(`
    SELECT id, name, levelId, MIN(time) as time, created_at
    FROM leaderboard
    GROUP BY name, levelId
    ORDER BY time ASC
  `);
  return query.all() as LeaderboardEntry[];
}
