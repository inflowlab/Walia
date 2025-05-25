import Database from "better-sqlite3";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";

export function initializeDatabase(dataDir: string) {
    const dbPath = `${dataDir}/db.sqlite`;
    const db = new Database(dbPath);
    return new SqliteDatabaseAdapter(db);
}