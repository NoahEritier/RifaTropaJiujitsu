import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type Client, type InValue } from '@libsql/client/web';
type Value = string | number | null;
type Row = Record<string, unknown>;
export class Statement {
  readonly owner: Database; readonly sql: string; readonly args: Value[];
  constructor(owner: Database, sql: string, args: Value[] = []) {this.owner=owner;this.sql=sql;this.args=args;}
  bind(...args: Value[]) { return new Statement(this.owner,this.sql,args); }
  async all<T = Row>() { return {results:await this.owner.execute(this) as T[]}; }
  async first<T = Row>() { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.owner.run(this); }
}
export class Database {
  private local?: DatabaseSync;
  private remote?: Client;
  readonly url?: string; readonly authToken?: string; readonly path: string;
  constructor(url?: string, authToken?: string, path = resolve(process.env.LOCAL_DATA_DIR || '.data/state','database.sqlite')) {this.url=url;this.authToken=authToken;this.path=path;}
  prepare(sql: string) { return new Statement(this,sql); }
  private connection() {
    if(!this.local) {
      if(process.env.VERCEL || process.env.NODE_ENV==='production' && !process.env.ALLOW_LOCAL_DATA) throw Error('Persistent database not configured');
      mkdirSync(dirname(this.path),{recursive:true});
      this.local = new DatabaseSync(this.path);
      this.local.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    }
    return this.local;
  }
  private client() {
    if(!this.url || !this.authToken || !/^(libsql|https):\/\//.test(this.url)) throw Error('Invalid remote database configuration');
    return this.remote ??= createClient({url:this.url,authToken:this.authToken});
  }
  async execute(statement: Statement): Promise<Row[]> {
    if(this.url) {
      const result=await this.client().execute({sql:statement.sql,args:statement.args as InValue[]});
      return result.rows.map(row=>({...row}));
    }
    const result=this.connection().prepare(statement.sql);
    if(result.columns().length) return result.all(...statement.args as SQLInputValue[]) as Row[];
    result.run(...statement.args as SQLInputValue[]); return [];
  }
  async run(statement: Statement) {
    if(this.url) {
      const result=await this.client().execute({sql:statement.sql,args:statement.args as InValue[]});
      return {success:true,meta:{changes:result.rowsAffected}};
    }
    const result=this.connection().prepare(statement.sql).run(...statement.args as SQLInputValue[]);
    return {success:true,meta:{changes:Number(result.changes)}};
  }
  async batch(statements: Statement[]) {
    if(statements.some(s=>s.owner!==this)) throw Error('Mixed database transaction');
    if(this.url) {
      await this.client().batch(statements.map(s=>({sql:s.sql,args:s.args as InValue[]})),'write');
      return;
    }
    const connection=this.connection();
    connection.exec('BEGIN IMMEDIATE');
    try {
      // Synchronous writes keep this transaction indivisible in the local process.
      for(const statement of statements) connection.prepare(statement.sql).run(...statement.args as SQLInputValue[]);
      connection.exec('COMMIT');
    } catch(error) { connection.exec('ROLLBACK'); throw error; }
  }
  close() { this.local?.close(); this.remote?.close(); }
}
let singleton: Database | undefined;
export function database() {
  if(process.env.VERCEL && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) throw Error('Persistent database not configured');
  return singleton ??= new Database(process.env.TURSO_DATABASE_URL,process.env.TURSO_AUTH_TOKEN);
}