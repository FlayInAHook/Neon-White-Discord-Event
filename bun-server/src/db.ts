import { Database } from "bun:sqlite";

const db = new Database("leaderboard.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    levelId TEXT NOT NULL,
    time INTEGER NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS teams (
    name1 TEXT NOT NULL,
    name2 TEXT NOT NULL,
    UNIQUE(name1, name2)
  )
`);

try {
  db.run(`ALTER TABLE leaderboard ADD COLUMN status TEXT DEFAULT 'completed'`);
} catch (e) {
  // column already exists
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  levelId: string;
  time: number;
  status: string;
  tries?: number;
  created_at: string;
}

export function addEntry(name: string, levelId: string, time: number, status: string = 'completed'): { isPB: boolean, isWR: boolean, previousBestTime?: number, previousWRTime?: number, previousRecordHolder?: string } {
  // Check previous bests
  let isPB = false;
  let isWR = false;
  let previousBestTime: number | undefined;
  let previousWRTime: number | undefined;
  let previousRecordHolder: string | undefined;

  if (status === 'completed') {
    const allBestQuery = db.query(`
      SELECT time as bestTime, name
      FROM leaderboard
      WHERE levelId = $levelId AND status = 'completed'
      ORDER BY time ASC
      LIMIT 1
    `);
    const allBestResult = allBestQuery.get({ $levelId: levelId }) as { bestTime: number, name: string } | null;
    const bestOverall = allBestResult?.bestTime;

    if (allBestResult) {
      previousRecordHolder = allBestResult.name;
    }

    const userBestQuery = db.query(`
      SELECT MIN(time) as bestTime
      FROM leaderboard
      WHERE levelId = $levelId AND name = $name AND status = 'completed'
    `);
    const userBestResult = userBestQuery.get({ $levelId: levelId, $name: name }) as { bestTime: number | null };
    const userBest = userBestResult?.bestTime;

    if (bestOverall === null || bestOverall === undefined || time < bestOverall) {
      isWR = true;
    }
    if (userBest === null || time < userBest) {
      isPB = true;
    }

    if (userBest !== null) {
      previousBestTime = userBest;
    }

    if (bestOverall !== null && bestOverall !== undefined) {
      previousWRTime = bestOverall;
    }
  }

  const query = db.query(`
    INSERT INTO leaderboard (name, levelId, time, status)
    VALUES ($name, $levelId, $time, $status)
  `);
  query.run({ $name: name, $levelId: levelId, $time: time, $status: status });

  return { isPB, isWR, previousBestTime, previousWRTime, previousRecordHolder };
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
  // Get the best time for each player per level, and count all attempts
  const query = db.query(`
    SELECT
      MIN(id) as id,
      name,
      levelId,
      MIN(CASE WHEN status = 'completed' THEN time END) as time,
      'completed' as status,
      COUNT(*) as tries,
      MIN(created_at) as created_at
    FROM leaderboard
    GROUP BY name, levelId
    HAVING MIN(CASE WHEN status = 'completed' THEN time END) IS NOT NULL
    ORDER BY MIN(CASE WHEN status = 'completed' THEN time END) ASC
  `);
  return query.all() as LeaderboardEntry[];
}

// User mapping and team helpers
export function linkAccount(name: string, discordId: string) {
  const query = db.query(`
    INSERT INTO users (name, discord_id)
    VALUES ($name, $discordId)
    ON CONFLICT(name) DO UPDATE SET discord_id=excluded.discord_id
  `);
  query.run({ $name: name, $discordId: discordId });
}

export function getUserDiscordId(name: string): string | null {
  const query = db.query(`SELECT discord_id FROM users WHERE name = $name`);
  const result = query.get({ $name: name }) as { discord_id: string } | null;
  return result?.discord_id || null;
}

export function createTeam(name1: string, name2: string) {
  // Store deterministically to avoid duplicate logic complexity (alpha sort)
  const sorted = [name1, name2].sort();
  const query = db.query(`
    INSERT OR IGNORE INTO teams (name1, name2)
    VALUES ($n1, $n2)
  `);
  query.run({ $n1: sorted[0] as string, $n2: sorted[1] as string });
}

export function deleteTeam(name1: string, name2: string) {
  const sorted = [name1, name2].sort();
  const query = db.query(`
    DELETE FROM teams WHERE name1 = $n1 AND name2 = $n2
  `);
  query.run({ $n1: sorted[0] as string, $n2: sorted[1] as string });
}

export function getTeams(): { name1: string, name2: string }[] {
  const query = db.query(`SELECT * FROM teams`);
  return query.all() as { name1: string, name2: string }[];
}
