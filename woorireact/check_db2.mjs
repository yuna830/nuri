import pg from "pg";
const { Client } = pg;
const client = new Client({
  host: "168.107.27.186", port: 5432, database: "woori", user: "woori", password: "woori1234"
});
async function main() {
  await client.connect();
  const s = await client.query("SELECT id, name, fall_api_url FROM seniors WHERE id = 10");
  console.log("=== seniors ===");
  s.rows.forEach(r => console.log(JSON.stringify(r)));
  const dup = await client.query("SELECT senior_id, snapshot_date::text, COUNT(*) as cnt FROM senior_activity_snapshots WHERE senior_id = 10 GROUP BY senior_id, snapshot_date ORDER BY snapshot_date DESC LIMIT 10");
  console.log("\n=== 날짜별 스냅샷 건수 ===");
  dup.rows.forEach(r => console.log(r.snapshot_date + " : " + r.cnt + "건"));
  await client.end();
}
main().catch(console.error);
